$.assign($, {
	_gameBoard: null,

	gameBoard: () => {
		if (!$._gameBoard) {
			$._gameBoard = $.getElementById('g')
		}
		return $._gameBoard;
	},

	// GameObjects are assigned when the game starts.
	gameObjects: [],

	enemyProjectiles: [],

	playerProjectiles: [],

	/**
	 * Adds an instantiated game object to the list of objects
	 * and renders the game object canvas.
	 */
	createGameObject: (obj) => {
		$.renderSeed(obj)
		$.gameObjects.push(obj)
	},

	createEnemyProjectile: (obj) => {
		$.createGameObject(obj)
		$.enemyProjectiles.push(obj)
	},

	createPlayerProjectile: (obj) => {
		$.createGameObject(obj)
		$.playerProjectiles.push(obj)
	},

	/**
	 * Destroys an object if it's outside the game rect.
	 * To destroy an object we set the destroy flag and remove all destroyed objects after rendering.
	 */
	destroyIfOutsideGameRect: (obj) => {
		if (obj[ObjectIndex.POSITION_X] < 0 || obj[ObjectIndex.POSITION_X] > GameIndex.WIDTH || obj[ObjectIndex.POSITION_Y] < 0 || obj[ObjectIndex.POSITION_Y] > GameIndex.HEIGHT) {
			obj[ObjectIndex.DESTROYED] = true
		}
	},

	renderSeed: (gameObject) => {
		let cnv = $.createElement('canvas');
		// TEMP: Store a reference to the canvas on each game object while things move with CSS.
		gameObject[ObjectIndex.DOM] = cnv
		$.appendChild($.gameBoard(), cnv);

		let ctx = $.getContext(cnv),
			r = $.getRandomNumberGenerator(gameObject[ObjectIndex.SEED])
			shapes = $.getRandomShapes(r, gameObject[ObjectIndex.WIDTH], gameObject[ObjectIndex.HEIGHT], gameObject[ObjectIndex.SEED_SHAPE_STR])

		gameObject[ObjectIndex.GENERATED_SHAPES] = shapes
	    shapes.forEach(rs => (rs.r ? $.drawCircle : $.drawPolygon)(ctx, rs))
	},

	drawLoop: () => {
		let i = $.gameObjects.length
		while (i--) {
			let obj = $.gameObjects[i]
			// Call .t (tick) on all objects
			obj[ObjectIndex.TICK]()

			$.processProjectile(obj)

			// Check if the object is destroyed.
			if (obj[ObjectIndex.DESTROYED]) {
				// Remove the object and splice the array
				$.removeChild($.gameBoard(), obj[ObjectIndex.DOM])
				$.gameObjects.splice(i, 1)
			} else {
				// Render the game object
				obj[ObjectIndex.DOM].style.transform = `translate(${obj[ObjectIndex.POSITION_X]}px, ${obj[ObjectIndex.POSITION_Y]}px)`
			}
		}
		setTimeout($.drawLoop, 16)
	},

	startGame: () => {
		// Initialize gameObjects
		$.gameObjects = [
			new $.PlayerGameObject(),
			new $.EnemyGameObject(6480, 600, 50, 'mv'),
			new $.EnemyGameObject(9004, 600, 250, 'm')
		]

		// Begin draw loop
		$.gameObjects.forEach($.renderSeed)
		$.drawLoop()
	},

	splashKeyListener: (e) => {
		if (e.key == ' ') {
			$.startGame()
			$.document.body.className = 'g'
			removeEventListener('keydown', $.splashKeyListener)
			$.initKeyboard()
		}
	},

	/**
	 * Processes all collisions for game objects.
	 */
	processProjectile: (gameObject) => {
		let i
		// TODO: Some duplication below.
		if (gameObject[ObjectIndex.OBJECT_TYPE] === ObjectTypeIndex.ENEMY) {
			// Process player projectiles
			i = $.playerProjectiles.length
			while (i--) {
				let projectile = $.playerProjectiles[i],
				collision = $.checkCollision(
					gameObject[ObjectIndex.GENERATED_SHAPES],
					// TODO: We can save space if we can just pass in a projectile and another game object
					[
						projectile[ObjectIndex.POSITION_X],
						projectile[ObjectIndex.POSITION_Y],
						2
					],
					gameObject[ObjectIndex.POSITION_X],
					gameObject[ObjectIndex.POSITION_Y]
				)
				if (collision) {
					gameObject[ObjectIndex.PROJECTILE_COLLISION](projectile)
					projectile[ObjectIndex.DESTROYED] = true
					$.playerProjectiles.splice(i, 1)
				}
			}
			
		} else if (gameObject[ObjectIndex.OBJECT_TYPE] === ObjectTypeIndex.PLAYER) {
			// Process enemy projectiles
			i = $.enemyProjectiles.length
			while (i--) {
				let projectile = $.enemyProjectiles[i],
				collision = $.checkCollision(
					gameObject[ObjectIndex.GENERATED_SHAPES]
					// TODO: We can save space if we can just pass in a projectile and another game object
					[
						projectile[ObjectIndex.POSITION_X],
						projectile[ObjectIndex.POSITION_Y],
						2
					],
					gameObject[ObjectIndex.POSITION_X],
					gameObject[ObjectIndex.POSITION_Y]
				)
				if (collision) {
					gameObject[ObjectIndex.PROJECTILE_COLLISION](projectile)
					projectile[ObjectIndex.DESTROYED] = true
					$.enemyProjectiles.splice(i, 1)
				}
			}
		}
	}
})

addEventListener('keydown', $.splashKeyListener)
