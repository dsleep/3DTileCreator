'use strict';


import * as decimate from "./decimate/decimate.js";
import * as simplify from "./decimate/simplify.js";
import * as glmatrix from './decimate/gl-matrix.js';

var scene, camera, renderer, controls, axis, gui;
const width = window.innerWidth;
const height = window.innerHeight;
const ratio = width / height;

function geometry_to_obj(geometry) {

    let { vertices, faces, faceVertexUvs } = geometry,
        hasUV = faceVertexUvs[0].length === faces.length,
        obj = '';

    for (let i = 0; i < vertices.length; i++) {

        let v = vertices[i];

        obj += `v ${v.x} ${v.y} ${v.z}\n`;
    }

    if (hasUV) {

        for (let i = 0; i < faces.length; i++) {

            let [a, b, c] = faceVertexUvs[0][i];

            obj += `vt ${a.x} ${a.y}\n`;

            obj += `vt ${b.x} ${b.y}\n`;

            obj += `vt ${c.x} ${c.y}\n`;
        }
    }

    for (let i = 0; i < faces.length; i++) {

        let { a, b, c } = faces[i],
            j = i * 3 + 1;

        if (hasUV) {

            obj += `f ${a + 1}/${j}/1 ${b + 1}/${j + 1}/1 ${c + 1}/${j + 2}/1\n`;
        } else {

            obj += `f ${a + 1} ${b + 1} ${c + 1}\n`;
        }
    }

    return obj;
}

function obj_to_geometry(obj) {

    let geometry = new THREE.BufferGeometry(),
        lines = obj.split(/[\r\n]/).filter(ln => ln && ln.length),
        vertices = [],
        uvs = [],
        uv_indices = [],
        indices = [];

    console.log('obj_to_geometry');

    console.time('parse obj');

    for (let i = 0; i < lines.length; i++) {

        let line = lines[i].split(/\s+/),
            cmd = line.shift();

        switch (cmd) {

            case 'v':

                vertices.push(line.map(parseFloat));

                break;

            case 'vt':

                uvs.push(line.map(parseFloat));

                break;

            case 'f':

                let face = line.map(f => f.split('/').map(i => parseInt(i, 10)));

                let vidx = face.map(f => f[0] - 1);

                indices.push(vidx);

                if (face[0].length > 1) {

                    let uvidx = face.map(f => f[1] - 1);

                    uv_indices.push(uvidx);
                }

                break;

            default:

                break;
        }
    }

    console.timeEnd('parse obj');

    console.time('obj => BufferGeometry');

    let num_faces = indices.length,
        v = [],
        uv = [],
        idx = [];

    for (let i = 0; i < indices.length; i++) {

        let [a, b, c] = indices[i],
            v0 = vertices[a],
            v1 = vertices[b],
            v2 = vertices[c],
            j = i * 3;

        v.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);

        if (uv_indices.length) {

            let [a, b, c] = uv_indices[i].map(i => uvs[i]);

            uv.push(a[0], a[1], b[0], b[1], c[0], c[1]);
        }

        idx.push(j, j + 1, j + 2);
    }

    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));

    if (uv_indices.length) {

        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    }

    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));

    geometry = new THREE.Geometry().fromBufferGeometry(geometry);

    geometry.mergeVertices();

    geometry.computeFaceNormals();

    console.timeEnd('obj => BufferGeometry');

    return geometry;
}

function geometry_to_simplify(geometry) {

    let mesh = { vertices: [], triangles: [] },
        { vertices, faces, faceVertexUvs } = geometry,
        numUvSets = faceVertexUvs.length;

    for (let i = 0; i < vertices.length; i++) {

        let v = vertices[i],
            vertex = new simplify.Vertex();

        vertex.p[0] = v.x;

        vertex.p[1] = v.y;

        vertex.p[2] = v.z;

        mesh.vertices.push(vertex);
    }

    for (let i = 0; i < faces.length; i++) {

        let { a, b, c } = faces[i],
            t = new simplify.Triangle(a, b, c);

        if (numUvSets > 0 && faceVertexUvs[0].length === faces.length) {

            t.uvs = new Array(numUvSets).map(i => []);
        }

        for (let j = 0; j < numUvSets; j++) {

            if (faceVertexUvs[j].length === faces.length) {

                t.uvs[j] = faceVertexUvs[j][i].map(u => glmatrix.vec3.fromValues(u.x, u.y, 0));
            }
        }

        mesh.triangles.push(t);
    }

    return mesh;
}

function simplify_to_geometry({ vertices, triangles }) {
    let geometry = new THREE.BufferGeometry(),
        uvbuf = [],
        vbuf = [],
        idxbuf = [];

    triangles.forEach((t, i) => {
        let [a, b, c] = t.v,
            va = vertices[a].p,
            vb = vertices[b].p,
            vc = vertices[c].p,
            idx = i * 3;

        if (t.uvs && t.uvs.length > 0) {
            let [ua, ub, uc] = t.uvs[0];
            uvbuf.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
        }

        vbuf.push(va[0], va[1], va[2], vb[0], vb[1], vb[2], vc[0], vc[1], vc[2]);
        idxbuf.push(idx, idx + 1, idx + 2);
    });

    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vbuf), 3));

    if (uvbuf.length) {
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvbuf), 2));
    }

    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(idxbuf), 1));

    geometry = new THREE.Geometry().fromBufferGeometry(geometry);
    geometry.mergeVertices();
    geometry.computeFaceNormals();
    //geometry.computeVertexNormals();
    return geometry;
}

function simplify_to_geometry_buffers(vertices, uvs, indices) {

    let geometry = new THREE.BufferGeometry();

  
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));

    if (uvs) {
        geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    geometry = new THREE.Geometry().fromBufferGeometry(geometry);
    geometry.mergeVertices();
    geometry.computeFaceNormals();
    //geometry.computeVertexNormals();
    return geometry;
}

function decimated_to_geometry({ vertices, triangles }) {
    let geometry = new THREE.BufferGeometry(),
        vbuf = [],
        uvbuf = [],
        idxbuf = [];

    triangles.forEach(({ indices, uvs }, i) => {
        let [a, b, c] = indices,
            va = vertices[a],
            vb = vertices[b],
            vc = vertices[c],
            idx = i * 3;
        vbuf.push(va[0], va[1], va[2], vb[0], vb[1], vb[2], vc[0], vc[1], vc[2]);
        if (uvs && uvs.length === 3) {
            let [ua, ub, uc] = uvs;
            uvbuf.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
        }
        idxbuf.push(idx, idx + 1, idx + 2);
    });

    geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vbuf), 3));
    if (uvbuf.length) {
        geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvbuf), 2));
    }
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(idxbuf), 1));

    geometry = new THREE.Geometry().fromBufferGeometry(geometry);
    geometry.mergeVertices();
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    return geometry;
}

//RS - DS
function BufferGeometryToSimplify(InGeometry, targetPercent) {
    let BaseGeometry = new THREE.Geometry().fromBufferGeometry(InGeometry);
    BaseGeometry.mergeVertices();

    //let SimplifiedGeo = geometry_to_simplify(BaseGeometry);
    //simplify.decimate(SimplifiedGeo, targetPercent);
    var ActualCount = BaseGeometry.faces.length * (targetPercent / 100.0);
    var options = {
        agressiveness: 7,
        recompute: false,
        update: 5
    };


    return simplify.simplify_three(BaseGeometry, ActualCount, options);

    //simplify.simplify(SimplifiedGeo, targetPercent, options);
    //return simplify_to_geometry(SimplifiedGeo);
}

function ThreeJSGeometryDecimate(object, GeometryMap, targetPercent) {

    object.updateWorldMatrix(false, false);
    
    var geometry = object.geometry;

    if (geometry !== undefined) {
        let NewGeo = BufferGeometryToSimplify(geometry, targetPercent);

        NewGeo.mergeVertices();
        NewGeo.computeFaceNormals();
        NewGeo.computeVertexNormals();

        GeometryMap.set(geometry, NewGeo);
        object.geometry = NewGeo;
    }

    var children = object.children;
    for (var i = 0, l = children.length; i < l; i++) {
        ThreeJSGeometryDecimate(children[i], GeometryMap, targetPercent);
    }    
}

const init = () => {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(45, ratio, 1, 10000);
	camera.position.z = 10;

	// dat.GUI()
	//gui = new dat.GUI();
	//gui.add(camera.position, 'z', 0, 800);
	// camera Orbit
	controls = new THREE.OrbitControls(camera, document.getElementById('webgl'));
	// axis helper
	axis = new THREE.AxesHelper(300);
	scene.add(axis);

	// instantiate a loader
	var loader = new THREE.OBJLoader();

	// load a resource
	loader.load(
		// resource URL
		'ABQSimpler.obj',
		// called when resource is loaded
		function ( object ) {
			//.makeRotationX
            object.applyMatrix(new THREE.Matrix4().makeRotationX(-1.57));

            var GeoMap = new Map();
            ThreeJSGeometryDecimate(object, GeoMap, 35);
			
			var FindBox = new THREE.Box3();
			FindBox.expandByObject(object);

			object.applyMatrix(new THREE.Matrix4().makeTranslation(-FindBox.getCenter().x, -FindBox.getCenter().y, -FindBox.getCenter().z));
			scene.add(object);

            //simplify_to_geometry

			var box = new THREE.BoxHelper(object, 0xffff00);
			scene.add( box );	
			
			var size = 1000;
			var divisions = 10;

			var gridHelper = new THREE.GridHelper(size, divisions);
			scene.add(gridHelper);
		},
		// called when loading is in progresses
		function ( xhr ) {

			console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

		},
		// called when loading has errors
		function ( error ) {

			console.log( 'An error happened' );

		}
	);

/*
	// Instantiate a loader
	var loader = new THREE.GLTFLoader();

	// Load a glTF resource
	loader.load(
		// resource URL
		'DroneModel.glb',
		// called when the resource is loaded
		function ( gltf ) {

			scene.add( gltf.scene );

			gltf.animations; // Array<THREE.AnimationClip>
			gltf.scene; // THREE.Scene
			gltf.scenes; // Array<THREE.Scene>
			gltf.cameras; // Array<THREE.Camera>
			gltf.asset; // Object

		},
		// called while loading is progressing
		function ( xhr ) {

			console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

		},
		// called when loading has errors
		function ( error ) {

			console.log( 'An error happened' );

		}
	);
	*/
	

	renderer = new THREE.WebGLRenderer({ antialias: true });

	renderer.setClearColor('#e5e5e5');
	renderer.setSize(width, height);

	document.getElementById('webgl').append(renderer.domElement);

	var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
	scene.add( directionalLight );

	//const sphere = getSphere(50, 32, 16, 0xffcc00);
	//const pointLight = getPointLight(0xffffff, 1, 1000);
	//scene.add(sphere);
	//scene.add(pointLight);
//pointLight.position.set(200, 0, 25);

	window.addEventListener('resize', () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	const animate = () => {
		//sphere.position.y = 100 * Math.abs(Math.cos(Date.now() * 0.01));
	};

	const render = () => {
		requestAnimationFrame(render);
		renderer.render(scene, camera);
		controls.update();
		animate();
		//gui.open();
	};
	render();
};

const getSphere = (radius, width, height, color) => {
  let geometry = new THREE.SphereGeometry(radius, width, height);
  let material = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geometry, material);
};

const getPointLight = (color, intensity, distance) => {
  let light = new THREE.PointLight(color, intensity, distance);
  return light;
};

init();
