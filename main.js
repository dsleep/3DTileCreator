var scene, camera, renderer, controls, axis, gui;
const width = window.innerWidth;
const height = window.innerHeight;
const ratio = width / height;

const init = () => {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(45, ratio, 1, 10000);
	camera.position.z = 10;

	// dat.GUI()
	gui = new dat.GUI();
	gui.add(camera.position, 'z', 0, 800);
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

			scene.add( object );

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
		gui.open();
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
