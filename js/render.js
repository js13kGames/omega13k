$.assign($, {
	framebuffers: Array(4),
	textures: Array(4),
	charTriangles: Array(15 * 12),
	charTriangleMap: {},
	charBits: Array(15),
	stars: new Float32Array(BackgroundConst.NUM_STARS * 4),
	plumes: new Float32Array(PlumeConst.MAX_PLUMES * 4),
	healthStatus: new Float32Array(StatusBarConst.HEALTH_SEGMENTS * 12),
	chronoStatus: new Float32Array(StatusBarConst.CHRONO_SEGMENTS * 12),
	bossStatus: new Float32Array(StatusBarConst.BOSS_SEGMENTS * 12),
	healthPerSegment: 1 / StatusBarConst.HEALTH_SEGMENTS,
	chronoPerSegment: 1 / StatusBarConst.CHRONO_SEGMENTS,
	bossPerSegment: 1 / StatusBarConst.BOSS_SEGMENTS,

	initializeCharacters: () => {
		let row, col, i;

		// set up bits and vertices for the individual pixels in a character
		for (row = 0; row < 5; row++) {
			for (col = 0; col < 3; col++) {
				i = row*3 + col;
				$.charBits[i] = Math.pow(2, i);

				let x = col * CharConst.PIXEL_WIDTH,
					y = row * CharConst.PIXEL_HEIGHT,
					w = CharConst.PIXEL_WIDTH,
					h = CharConst.PIXEL_HEIGHT;

					[
						x, y,
						x+w, y,
						x, y+h,

						x+w, y,
						x+w, y+h,
						x, y+h
					].forEach((v, idx) => {
						$.charTriangles[(i * 12) + idx] = v;
					});
			}
		}

		// set up the triangles
		for (var key in $.charCodes) {
			$.charTriangleMap[key] = $.getTrianglesForChar(key);
		}
	},

	getTrianglesForChar: (char) => {
		let bits = $.charCodes[char];
		let triangles = [];
		for (var i = 0; i < $.charBits.length; i++) {
			if (bits & $.charBits[i]) {
				triangles = triangles.concat($.charTriangles.slice(i * 12, (i + 1) * 12));
			}
		}
		return new Float32Array(triangles);
	},

	renderDialog: (gl, prog, text) => {
		let col = 0, line = 0, i;

		for ( i = 0; i < text.length; i++) {
			let char = text[i],
			  triangles = $.charTriangleMap[char],
				x = CharConst.TEXT_OFFSET_X + col * (CharConst.PIXEL_WIDTH * 3 + CharConst.CHAR_PADDING),
				y = CharConst.TEXT_OFFSET_Y + line * (CharConst.PIXEL_HEIGHT * 5 + CharConst.CHAR_PADDING);

			if (typeof triangles === 'undefined') {
				throw new Error('Unable to render: "' + char + '"');
			}

			gl.uniform2f(gl.getUniformLocation(prog, 'u_offset'), x, y);
			gl.uniform4f(gl.getUniformLocation(prog, 'u_color'), 1., 1., 1., 1.);
			gl.bufferData(gl.ARRAY_BUFFER, triangles, gl.STATIC_DRAW);
			gl.drawArrays(gl.TRIANGLES, 0, triangles.length / 2);

			if (char === '\n') {
				line++;
				col = 0;
			} else {
				col++;
			}
		}
	},

	initializeStatusBar: (numSegments, yOffset, height, arr) => {
		let padding = 2;
		let widthPerSegment = Math.floor(GameConst.WIDTH / numSegments) - padding;
		let totalWidth = widthPerSegment * numSegments + padding * (numSegments - 1);
		let leftPadding = Math.floor((GameConst.WIDTH - totalWidth) / 3);
		let i;

		for (i = 0; i < numSegments; i++) {
			let x = i * (widthPerSegment + padding) + leftPadding;
			let y = yOffset;
			let w = widthPerSegment;
			let h = height;

			[
				x, y,
				x+w, y,
				x, y+h,

				x+w, y,
				x, y+h,
				x+w, y+h
			].forEach((v, idx) => {
				arr[(i * 12) + idx] = v;
			});
		}
	},

	initializeStatusBars: () => {
		$.initializeStatusBar(StatusBarConst.HEALTH_SEGMENTS, StatusBarConst.HEALTH_Y_OFFSET, StatusBarConst.HEALTH_HEIGHT, $.healthStatus);
		$.initializeStatusBar(StatusBarConst.CHRONO_SEGMENTS, StatusBarConst.CHRONO_Y_OFFSET, StatusBarConst.CHRONO_HEIGHT, $.chronoStatus);
		$.initializeStatusBar(StatusBarConst.BOSS_SEGMENTS, StatusBarConst.BOSS_Y_OFFSET, StatusBarConst.BOSS_HEIGHT, $.bossStatus);
	},

	renderStatusBars: (gl, prog, width, height) => {
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		gl.uniform2f(gl.getUniformLocation(prog, 'u_offset'), 0., 0.);
		$.renderHealth(gl, prog, width, height);
		$.renderChrono(gl, prog, width, height);
		if ($.inBossLevel) {
			$.renderBossHealth(gl, prog, width, height);
		}
	},

	renderBar: (gl, prog, percentage, percentagePerSegment, color, segments, numSegments) => {
		if (percentage >= 1) {
			// render full bar
			gl.uniform4f(gl.getUniformLocation(prog, "u_color"), ...color, 1);
	    gl.bufferData(gl.ARRAY_BUFFER, segments, gl.STATIC_DRAW);
	    gl.drawArrays(gl.TRIANGLES, 0, numSegments * 6);
		} else if (percentage > 0) {
			let visibleSegments = Math.floor(percentage / percentagePerSegment);

			if (visibleSegments > 0) {
				gl.uniform4f(gl.getUniformLocation(prog, "u_color"), ...color, 1);
		    gl.bufferData(gl.ARRAY_BUFFER, segments, gl.STATIC_DRAW);
		    gl.drawArrays(gl.TRIANGLES, 0, visibleSegments * 6);
			}

			let lastColor = (percentage - (visibleSegments * percentagePerSegment)) / percentagePerSegment;
			if (lastColor > 0) {
				gl.uniform4f(gl.getUniformLocation(prog, "u_color"), ...color, lastColor);
		    gl.bufferData(gl.ARRAY_BUFFER, segments, gl.STATIC_DRAW);
		    gl.drawArrays(gl.TRIANGLES, visibleSegments * 6, 6);
			}
		}
	},

	renderHealth: (gl, prog, width, height) => {
		$.renderBar(gl, prog, $.getCurrentPlayerHealth() / PlayerConst.MAX_HEALTH, $.healthPerSegment,
			$.getShaderColor(StatusBarConst.HEALTH_COLOR), $.healthStatus, StatusBarConst.HEALTH_SEGMENTS);
	},

	renderChrono: (gl, prog, width, height) => {
		$.renderBar(gl, prog, $.playerChrono / PlayerConst.MAX_CHRONO, $.chronoPerSegment,
			$.getShaderColor(StatusBarConst.CHRONO_COLOR), $.chronoStatus, StatusBarConst.CHRONO_SEGMENTS);
	},

  renderBossHealth: (gl, prog, width, height) => {
		$.renderBar(gl, prog, $.getCurrentBossHealth() / $.maxBossHealth, $.bossPerSegment,
			$.getShaderColor(StatusBarConst.BOSS_COLOR), $.bossStatus, StatusBarConst.BOSS_SEGMENTS);
	},

	prepareCanvasForShapes: (gl, width, height) => {
    let prog = $.get2DProgram(gl)

    var posLocation = gl.getAttribLocation(prog, 'a_position');
  	gl.useProgram(prog);
		gl.disable(gl.BLEND);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
    	gl.ARRAY_BUFFER,
      $.SCREEN_VERTICES,
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), width, height)

    return prog;
  },

	prepareCanvasForProjectiles: (gl, width, height) => {
	    let prog = $.getProjectilesProgram(gl)

	    gl.useProgram(prog)
	    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), width, height)

	    return prog;
	},

	prepareCanvasForPlumes: (gl, width, height) => {
	    let prog = $.getPlumesProgram(gl);

	    gl.useProgram(prog);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	    gl.uniform2f(gl.getUniformLocation(prog, 'uResolution'), width, height)
			gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), $.levelGameTime * 0.001);

	    return prog;
	},

	renderPlayer: (gl, prog, position) => {
		if ($.gameState !== GameStateConst.LOST) {
			$.drawShapesToCanvasGL(gl, prog, $.playerShapes, ...position)
		}
	},

	initializePlumes: () => {
		for (var i=0; i < PlumeConst.MAX_PLUMES; i++)  {
   		// set up the distance from the center
   		let dist = 0.8 * Math.random() * Math.random() * Math.random();
      // based on distance, set up the lifetime
      let lifetime = (dist + 1.5) * Math.random() + 1;
      // set the velocity
      let velocity = ( 30.0 *(Math.random()) );
      // choose whether distance is positive or negative
      if (Math.random() < 0.5) dist *= -1;
      dist *= 5;
      $.plumes[(i * 4) + 0] = velocity;
      $.plumes[(i * 4) + 1] = dist;
      $.plumes[(i * 4) + 2] = lifetime;
      $.plumes[(i * 4) + 3] = 1 / lifetime;
   }
	},

	renderPlayerPlumes: (gl, prog, position) => {
		if ($.gameState === GameStateConst.LOST) return;
		gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), 0.4, 0.4, 0.8);
		gl.uniform1f(gl.getUniformLocation(prog, 'uDirection'), -0.5);

		let originLoc = gl.getUniformLocation(prog, 'uOrigin'),
			posLoc = gl.getAttribLocation(prog, 'aPos');

		gl.enableVertexAttribArray( posLoc );
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, $.plumes, gl.STATIC_DRAW);
		gl.vertexAttribPointer( posLoc, 4, gl.FLOAT, false, 0, 0);

		gl.uniform3f(originLoc, position[0], position[1] + 11, 0)
		gl.drawArrays(gl.POINTS, 0, PlumeConst.MAX_PLUMES);

		gl.uniform3f(originLoc, position[0], position[1] + GameConst.SHIP_HEIGHT - 11, 1)
		gl.drawArrays(gl.POINTS, 0, PlumeConst.MAX_PLUMES);
	},

	renderEnemyPlumes: (gl, prog) => {
		gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), 0.8, 0.4, 0.4);
		gl.uniform1f(gl.getUniformLocation(prog, 'uDirection'), 0.5);

		let originLoc = gl.getUniformLocation(prog, 'uOrigin'),
			posLoc = gl.getAttribLocation(prog, 'aPos'),
			posIdx, i;

		gl.enableVertexAttribArray( posLoc );
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, $.plumes, gl.STATIC_DRAW);
		gl.vertexAttribPointer( posLoc, 4, gl.FLOAT, false, 0, 0);

		for (i = 0; i < $._activeEnemyCount; i++){
			posIdx = i * 2;
			gl.uniform3f(originLoc, $._activeEnemyPositions[posIdx] + GameConst.SHIP_WIDTH, $._activeEnemyPositions[posIdx+1] + GameConst.HALF_SHIP_HEIGHT, i)
			gl.drawArrays(gl.POINTS, 0, PlumeConst.MAX_PLUMES);
		}
	},

	renderEnemies: (gl, prog) => {
		for (let i = 0; i < $._activeEnemyCount; i++){
			let posIdx = i * 2;
			let enemy = $.levelEnemies[$._activeEnemyIndexes[i]];
			let shapes = enemy[LevelShipIndex.SHAPES];

			$.drawShapesToCanvasGL(gl, prog, shapes, $._activeEnemyPositions[posIdx], $._activeEnemyPositions[posIdx+1]);
		}
	},

	renderEnemyProjectiles: (gl, prog, projectiles) => {
		if ($._activeEnemyProjectileCount > 0) {
			let prog = $.prepareCanvasForProjectiles(gl, GameConst.WIDTH, GameConst.HEIGHT);

			let pointsLoc = gl.getAttribLocation(prog, 'aPoint');
			let colorLoc = gl.getUniformLocation(prog, 'u_color');
			gl.uniform3f(colorLoc, 0.8, 0.4, 0.4);

			gl.enableVertexAttribArray(pointsLoc);
		  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		  gl.bufferData(gl.ARRAY_BUFFER, $._activeEnemyProjectilePositions, gl.STATIC_DRAW);
		  gl.vertexAttribPointer(pointsLoc, 2, gl.FLOAT, false, 0, 0);

			gl.drawArrays(gl.POINTS, 0, $._activeEnemyProjectileCount);
		}
	},

	renderPlayerProjectiles: (gl, prog, projectiles, pos) => {
		if ($._activePlayerProjectileCount > 0) {
			let prog = $.prepareCanvasForProjectiles(gl, GameConst.WIDTH, GameConst.HEIGHT);

			let pointsLoc = gl.getAttribLocation(prog, 'aPoint');
			let colorLoc = gl.getUniformLocation(prog, 'u_color');
			gl.uniform3f(colorLoc, 0.4, 0.4, 0.8);

			gl.enableVertexAttribArray(pointsLoc);
		  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		  gl.bufferData(gl.ARRAY_BUFFER, $._activePlayerProjectilePositions, gl.STATIC_DRAW);
		  gl.vertexAttribPointer(pointsLoc, 2, gl.FLOAT, false, 0, 0);

			gl.drawArrays(gl.POINTS, 0, $._activePlayerProjectileCount);
		}
	},

	createTexture: (gl) => {
		let texture = gl.createTexture(gl);
		gl.bindTexture(gl.TEXTURE_2D, texture);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		return texture;
	},

	loadTexture: (gl, fbIdx, width, height) => {
		if ($.textures[fbIdx] === undefined) {
			$.textures[fbIdx] = gl.createTexture();
		}
		gl.bindTexture(gl.TEXTURE_2D, $.textures[fbIdx]);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		return $.textures[fbIdx];
	},

	loadFramebuffer: (gl, fbIdx, texture) => {
		if ($.framebuffers[fbIdx] === undefined) {
			$.framebuffers[fbIdx] = gl.createFramebuffer();
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, $.framebuffers[fbIdx]);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		return $.framebuffers[fbIdx];
	},

	initializeStarfield: () => {
		let r = $.getRandomNumberGenerator(BackgroundConst.SEED), i;
		// create a few hundred stars
		for (i = 0; i < BackgroundConst.NUM_STARS; ++i) {
			// init x, init y, brightness, velocity
			$.stars[(i*4) + 0] = $.randBetween(r, 0, GameConst.WIDTH);
			$.stars[(i*4) + 1] = $.randBetween(r, 0, GameConst.HEIGHT);
			$.stars[(i*4) + 2] = $.randBetweenFloat(r, BackgroundConst.MIN_BRIGHTNESS, BackgroundConst.MAX_BRIGHTNESS);
			$.stars[(i*4) + 3] = $.randBetweenFloat(r, BackgroundConst.MIN_VELOCITY, BackgroundConst.MAX_VELOCITY);
		}
	},

	updateStarfield: (elapsedTime) => {
		for (let i = 0; i < BackgroundConst.NUM_STARS; ++i) {
			$.stars[(i*4) + 0] = ($.stars[(i*4) + 0] - (elapsedTime * $.stars[(i*4) + 3]) + GameConst.WIDTH) % GameConst.WIDTH;
		}
	},

	renderStarfield: (gl, width, height) => {
		let prog = $.getStarfieldProgram(gl);
		gl.useProgram(prog)

		let pointsLoc = gl.getAttribLocation(prog, 'aStar');
		let resolutionLoc = gl.getUniformLocation(prog, 'u_resolution');
		gl.uniform2f(resolutionLoc, GameConst.WIDTH, GameConst.HEIGHT);

		gl.enableVertexAttribArray(pointsLoc);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, $.stars, gl.STATIC_DRAW);
		gl.vertexAttribPointer(resolutionLoc, 4, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.POINTS, 0, BackgroundConst.NUM_STARS);
  },

	renderGame: () => {
		// initialize the canvas
		let canvas = $.getCanvas();
		let gl = $.get3DContext(canvas);
		let playerPosition = $.getCurrentPlayerPosition();
		$.clear3DCanvas(gl);

		// draw the background
		$.renderStarfield(gl, canvas.width, canvas.height);

		// render engine plumes
		let plumeProg = $.prepareCanvasForPlumes(gl, canvas.width, canvas.height);
		$.renderEnemyPlumes(gl, plumeProg);
		$.renderPlayerPlumes(gl, plumeProg, playerPosition);

		// render shapes
		let shapeProg = $.prepareCanvasForShapes(gl, canvas.width, canvas.height);
		$.renderEnemies(gl, shapeProg);
		$.renderPlayer(gl, shapeProg, playerPosition);

		// render health bar
		$.renderStatusBars(gl, shapeProg, canvas.width, canvas.height);


		// render projectiles
		let pointProg = $.prepareCanvasForProjectiles(gl, canvas.width, canvas.height);
		$.renderEnemyProjectiles(gl, pointProg, $.enemyProjectiles);
		$.renderPlayerProjectiles(gl, pointProg, $.playerProjectiles, playerPosition);

		gl.useProgram(shapeProg);
		let dialog = $.currentDialog();
		if (dialog !== undefined && dialog.length) {
			$.renderDialog(gl, shapeProg, dialog);
		}

		gl.flush();
	},

	initializeRendering: () => {
		$.initializeStarfield();
		$.initializePlumes();
		$.initializeStatusBars();
		$.initializeCharacters();
	}
})
