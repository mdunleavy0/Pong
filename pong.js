window.onload = function() {

	// Get canvas and context
	var canvas = document.getElementById('canvas');
	var ctx = canvas.getContext('2d');

	// Colour palette
	var colors = {
		"primary": "magenta",
		"secondary": "",
		"tertiary": "",
		"background0": "white",
		"background1": "#130813",
		"pause": "rgba(50, 50, 50, 0.5)",
	};

	// Dimensions of the arena's border
	var borderW = 6;
	var borderRounding = 40;

	// Arena boundaries and dimensions
	var arena = {
		"top": borderW,
		"rgt": canvas.width - borderW,
		"btm": canvas.height - borderW,
		"lft": borderW,
		"w": canvas.width - 2 * borderW,
		"h": canvas.height - 2 * borderW,
	};

	var scores = {
		"p1": 0,
		"p2": 0,

		"winning": 11,
	};

	// Variables pertaining to both paddles
	var paddles = {
		"w": 20,
		"h": arena.h * 0.2,

		// Paddles' distances from the edge of the canvas
		"margin": borderRounding,

		"vel": 10,
	};
	paddles.rounding = paddles.w / 3;

	// Player 1
	var p1 = {
		"x": paddles.margin,
		"y": canvas.height / 2 - paddles.h / 2,

		"movingUp": false,
		"movingDown": false,
	};

	// Player 2
	var p2 = {
		"x": canvas.width - paddles.margin - paddles.w,
		"y": canvas.height / 2 - paddles.h / 2,

		"movingUp": false,
		"movingDown": false,
	};

	var ball = {
		"r": 12,
		"x": canvas.width / 2,
		"y": canvas.height / 2,

		"vel": null,
		"minVel": 10,
		"xVel": 0,
		"yVel": 0,
		"accel": 0.05, // As a percent of velocity

		"angles": {
			// Angle the ball travels at, in degrees, relative to 3 o'clock, clockwise
			"main": null,

			"correctionMargin": 10,
			"spawnCone": 45,
		},

		// Stores where the previous collision was, in case a single collision is detected twice
		"lastCollision": null,

		"deflectDistort": {
			"max": 45,
		},

		"fade": {
			"inProgress": false,
			"alpha": 0.0,
		},
	};

	var mainloopIntervalId;
	var frameTime = 15;

	// Whether we not playing and are between games
	var betweenGames = true;

	// Whether the game is paused
	var paused = false;

	/*
		Plots the path of a rectangle with rounded corners (of radius, r)
	*/
	function plotRoundRect(context, x, y, w, h, r) {
		context.beginPath();
		context.moveTo((x + r), y);
		context.arc((x + w - r), (y + r), r, 1.5 * Math.PI, 0);
		context.arc((x + w - r), (y + h - r), r, 0, 0.5 * Math.PI);
		context.arc((x + r), (y + h - r), r, 0.5 * Math.PI, Math.PI);
		context.arc((x + r), (y + r), r, Math.PI, 1.5 * Math.PI);
	}

	function drawScores() {
		ctx.textBaseline = 'top';
		var y = arena.top + 20;

		ctx.textAlign = 'right';
		var x = canvas.width / 2 - 50;
		ctx.fillText(scores.p1, x, y);

		ctx.textAlign = 'left';
		x = canvas.width / 2 + 50;
		ctx.fillText(scores.p2, x, y);
	}

	/*
		Draws the game onto the canvas.
	*/
	function draw() {
		// Draw over everything, including outside the rounded corners
		ctx.fillStyle = colors.background0;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = colors.primary;
		plotRoundRect(ctx, 0, 0, canvas.width, canvas.height, borderRounding);
		ctx.fill();

		ctx.fillStyle = colors.background1;
		plotRoundRect(ctx, arena.lft, arena.top, arena.w, arena.h, borderRounding - borderW);
		ctx.fill();

		// Draw centre-line
		ctx.strokeStyle = colors.primary;
		ctx.lineWidth = borderW;
		ctx.beginPath();
		ctx.moveTo(canvas.width / 2, 0);
		ctx.lineTo(canvas.width / 2, canvas.height);
		ctx.stroke();

		ctx.fillStyle = colors.primary;

		ctx.font = '50pt Sans-serif';
		drawScores();

		// Draw paddles
		plotRoundRect(ctx, p1.x, p1.y, paddles.w, paddles.h, paddles.rounding);
		ctx.fill();
		plotRoundRect(ctx, p2.x, p2.y, paddles.w, paddles.h, paddles.rounding);
		ctx.fill();

		// Draw ball
		ballFadeIterator();
		ctx.globalAlpha = ball.fade.alpha;
		ctx.beginPath();
		ctx.arc(ball.x, ball.y, ball.r, 0, 2 * Math.PI);
		ctx.fill();

		ctx.globalAlpha = 1.0;
	}

	function drawPauseBackground() {
		ctx.fillStyle = colors.pause;
		plotRoundRect(ctx, 0, 0, canvas.width, canvas.height, borderRounding);
		ctx.fill();
	}

	function drawToBeginMsg() {
		ctx.globalAlpha = 1.0;
		ctx.fillStyle = colors.primary;
		ctx.font = '32pt Sans-serif';
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
		var toBeginMsg = "Press Space to Begin";
		ctx.fillText(toBeginMsg, arena.lft + 40, arena.btm - 40);
	}

	function movePaddles() {
		if (p1.movingUp && p1.y > arena.top) {
			p1.y -= paddles.vel;
			if (p1.y < arena.top) {
				p1.y = arena.top;
			}
		}

		if (p1.movingDown && p1.y < arena.btm - paddles.h) {
			p1.y += paddles.vel;
			if (p1.y > arena.btm - paddles.h) {
				p1.y = arena.btm - paddles.h;
			}
		}

		if (p2.movingUp && p2.y > arena.top) {
			p2.y -= paddles.vel;
			if (p2.y < arena.top) {
				p2.y = arena.top;
			}
		}

		if (p2.movingDown && p2.y < arena.btm - paddles.h) {
			p2.y += paddles.vel;
			if (p2.y > arena.btm - paddles.h) {
				p2.y = arena.btm - paddles.h;
			}
		}
	}

	var i0 = 0;
	function accelerateBall() {
		// Increase velocity by a constant factor
		ball.vel += ball.vel * ball.accel;
		i0++;

		/*
			Ensure that ball's velocity is less than the paddle width.
			If ball was too fast it might go straight through the paddles.
		*/
		if (ball.vel > paddles.w - 0.01) {
			ball.vel = paddles.w - 0.01;
		}
	}

	function collisionManager(){
		if (ball.lastCollision != "p1" &&
			ball.x - ball.r < p1.x + paddles.w && ball.x - ball.r > p1.x &&
			ball.y + ball.r > p1.y && ball.y - ball.r < p1.y + paddles.h) {
			ball.lastCollision = "p1";
			accelerateBall();
			ball.angles.main = 180 - ball.angles.main;

			deflectionDistorter(p1);

			angleCorrection();
			calculateVelocities();
		}

		else if (ball.lastCollision != "p2" &&
			ball.x + ball.r > p2.x && ball.x + ball.r < p2.x + paddles.w &&
			ball.y + ball.r > p2.y && ball.y - ball.r < p2.y + paddles.h) {
			ball.lastCollision = "p2";
			accelerateBall();
			ball.angles.main = 180 - ball.angles.main;
			deflectionDistorter(p2);
			angleCorrection();
			calculateVelocities();
		}

		else if (ball.lastCollision != "lftWall" && ball.x - ball.r < arena.lft) {
			ball.lastCollision = "lftWall";
			/*ball.angles.main = 180 - ball.angles.main;
			ball.angles.main = tidyAngle(ball.angles.main);
			angleCorrection();
			calculateVelocities();*/
			victoryCheck(2);
			resetBall(2, 2);
		}

		else if (ball.lastCollision != "rgtWall" && ball.x + ball.r > arena.rgt) {
			ball.lastCollision = "rgtWall";
			/*ball.angles.main = 180 - ball.angles.main;
			ball.angles.main = tidyAngle(ball.angles.main);
			angleCorrection();
			calculateVelocities();*/
			victoryCheck(1);
			resetBall(1, 1);
		}

		if (ball.lastCollision != "topWall" && ball.y - ball.r < arena.top) {
			ball.lastCollision = "topWall";
			ball.angles.main = -ball.angles.main;
			ball.angles.main = tidyAngle(ball.angles.main);
			angleCorrection();
			calculateVelocities();
		}

		else if (ball.lastCollision != "btmWall" && ball.y + ball.r > arena.btm) {
			ball.lastCollision = "btmWall";
			ball.angles.main = -ball.angles.main;
			ball.angles.main = tidyAngle(ball.angles.main);
			angleCorrection();
			calculateVelocities();
		}
	}

	/*
		Detects how far from the paddle's vertical centre the ball is
		and distorts the angle the bounces at, depending on this.
	*/
	function deflectionDistorter(player) {
		// Calculate distortion
		paddles.collisionZoneH = paddles.h / 2 + ball.r;
		player.midY = player.y + paddles.h / 2;
		ball.deflectDistort.disp = ball.y - player.midY;
		ball.deflectDistort.ratio = ball.deflectDistort.disp / paddles.collisionZoneH;
		if (player == p1) {
			ball.deflectDistort.angle = ball.deflectDistort.ratio * ball.deflectDistort.max;
		}
		else {
			ball.deflectDistort.angle = -(ball.deflectDistort.ratio * ball.deflectDistort.max);
		}

		// Apply distortion
		ball.angles.main += ball.deflectDistort.angle;

		ball.angles.main = tidyAngle(ball.angles.main);

		// Correct the angle if it was over-distorted (ie. if the ball was about to bounce behind the paddle)
		if (player == p1) {
			if (ball.angles.main > 90 - ball.angles.correctionMargin && ball.angles.main < 180) {
				ball.angles.main = 90 - ball.angles.correctionMargin;
			}
			else if (ball.angles.main >= 180 && ball.angles.main < 270 + ball.angles.correctionMargin) {
				ball.angles.main = 270 + ball.angles.correctionMargin;
			}
		}
		else {
			if (ball.angles.main >= 0 && ball.angles.main < 90 + ball.angles.correctionMargin) {
				ball.angles.main = 90 + ball.angles.correctionMargin;
			}
			else if (ball.angles.main > 270 - ball.angles.correctionMargin && ball.angles.main < 360) {
				ball.angles.main = 270 - ball.angles.correctionMargin;
			}
		}
	}

	/*
		Adds or subtracts 360 degrees to an angle
		until it is >= 0 and < 360
	*/
	function tidyAngle(angle) {
		while (angle < 0) {
			angle += 360;
		}
		while (angle >= 360) {
			angle -= 360;
		}

		return angle;
	}

	/*
		Generate a random float within a specified range
	*/
	function randRange(min, max) {
		return (Math.random() * (max - min) + min);
	}

	/*
		If main angle is too close to vertical, widen the angle by a set margin.
		Requires the main angle to be between 0 and 360 degrees.
	*/
	function angleCorrection() {

		if (ball.angles.main > 90 - ball.angles.correctionMargin && ball.angles.main <=90) {
			ball.angles.main = 90 - ball.angles.correctionMargin;
		}
		else if (ball.angles.main > 90 && ball.angles.main < 90 + ball.angles.correctionMargin) {
			ball.angles.main = 90 + ball.angles.correctionMargin;
		}
		else if (ball.angles.main > 270 - ball.angles.correctionMargin && ball.angles.main <= 270) {
			ball.angles.main = 270 - ball.angles.correctionMargin;
		}
		else if (ball.angles.main > 270 && ball.angles.main < 270 + ball.angles.correctionMargin) {
			ball.angles.main = 270 + ball.angles.correctionMargin;
		}
	}

	/*
		Takes the ball's total speed and the angle it is travelling at,
		and calculates it's horizontal and vertical velocities.
	*/
	function calculateVelocities() {
		ball.angles.rads = ball.angles.main * (Math.PI / 180);
		ball.xVel = ball.vel * Math.cos(ball.angles.rads);
		ball.yVel = ball.vel * Math.sin(ball.angles.rads);
	}

	/*
		Enables the ball to fade from fully opaque to fully transparent or vice versa.
		Calculates how much the ball should fade by each time ballFadeIterator is called during the main loop.
		Allows a callback function once the fade is complete.
	*/
	function ballFade(type, time, callback) {
		ball.fade.iterations = time / frameTime;
		ball.fade.fadePerIter = 1.0 / ball.fade.iterations;

		if (type == "out") {
			ball.fade.fadePerIter = -ball.fade.fadePerIter;
		}

		ball.fade.inProgress = true;

		setTimeout(function() {
			if (type =="in") {
				ball.fade.alpha = 1.0;
			}
			else {
				ball.fade.alpha = 0.0;
			}
			ball.fade.inProgress = false;
			callback();
		}, time);
	}

	/*
		Changes the ballAlpha value slightly each time it is called.
		Every time the ball is drawn this function is called beforehand.
	*/
	function ballFadeIterator() {
		if (ball.fade.inProgress) {
			ball.fade.alpha += ball.fade.fadePerIter;

			// In case I fade the ball too much
			if (ball.fade.alpha > 1.0) {
				ball.fade.alpha = 1.0;
			}
			else if (ball.fade.alpha < 0.0) {
				ball.fade.alpha = 0.0;
			}
		}
	}

	function removeBall(callback) {
		// Stop the ball
		ball.xVel = 0;
		ball.yVel = 0;

		ballFade("out", 1000, callback);
	}

	function newBall(receiver, scorer) {
		// Move the ball to the centre of the arena
		ball.x = canvas.width / 2;
		ball.y = canvas.height /2;

		ball.lastCollision = "newBall";

		// Give the scorer a point
		if (scorer == 1) {
			scores.p1++;
		}
		else if (scorer == 2) {
			scores.p2++;
		}

		// Fade the ball in
		ballFade("in", 1000, function() {
			// Point the ball towards the receiver, with some randomness
			if (receiver == 1) {
				ball.angles.main = randRange(180 - ball.angles.spawnCone, 180 + ball.angles.spawnCone);
			}
			else {
				ball.angles.main = randRange(0 - ball.angles.spawnCone, 0 + ball.angles.spawnCone);
			}

			// Launch the ball
			ball.vel = ball.minVel;
			calculateVelocities();
		});
	}

	function newGame(){
		scores.p1 = 0;
		scores.p2 = 0;

		newBall(1);

		mainloopIntervalId = setInterval(mainloop, frameTime);
	}

	/*
		Removes ball,
		then gets a new ball on callback
	*/
	function resetBall(receiver, scorer) {
		removeBall(function() {
			newBall(receiver, scorer);
		});
	}

	function victoryCheck(scorer) {
		if (scorer == 1) {
			score = scores.p1;
		}
		else {
			score = scores.p2;
		}

		if (score > scores.winning - 2) {
			victorySeq(scorer);
		}
	}

	function victorySeq(victor) {
		removeBall(function() {
			// Stop the game
			clearInterval(mainloopIntervalId);
			betweenGames = true;

			// Draw once with updated scores
			if (victor == 1) {
				scores.p1++;
			}
			else {
				scores.p2++;
			}
			draw();

			drawPauseBackground();


			ctx.globalAlpha = 1.0;
			ctx.fillStyle = colors.primary;
			ctx.font = '32pt Sans-serif';
			ctx.textBaseline = 'top';

			if  (victor == 1) {
				ctx.textAlign = 'left';
				ctx.fillText("Player 1 Wins", canvas.width / 2 + 50, 150);
			}
			else {
				ctx.textAlign = 'right';
				ctx.fillText("Player 2 Wins", canvas.width / 2 - 50, 150);
			}

			drawToBeginMsg();
		});
	}

	function mainloop() {
		movePaddles();
		ball.x += ball.xVel;
		ball.y += ball.yVel;
		draw();
		collisionManager();
	}

	function pause() {
		if (!betweenGames) {
			paused = !paused;

			//Pause
			if (paused) {
				// Stop the game
				clearInterval(mainloopIntervalId);

				drawPauseBackground();

				// Write "Paused"
				ctx.globalAlpha = 1.0;
				ctx.fillStyle = colors.primary;
				ctx.font = '50pt Sans-serif';
				ctx.textAlign = 'right';
				ctx.textBaseline = 'alphabetic';
				ctx.fillText("Paused", arena.rgt - 40, arena.btm - 40);
			}

			// Unpause
			else {
				mainloopIntervalId = setInterval(mainloop, frameTime);
			}
		}
	}

	draw();
	drawPauseBackground();
	drawToBeginMsg();

	// If user presses down on a valid key,
	// change the movement signal to true
	window.onkeydown = function(e) {
		var key = e.which;
		if (key == "87")  // 87 = a
		{
			p1.movingUp = true;
		}
		else if (key == "83") // 83 = s
		{
			p1.movingDown = true;
		}
		else if (key == "38") // 38 = Up Arrow
		{
			p2.movingUp = true;
		}
		else if (key == "40") // 40 = Down Arrow
		{
			p2.movingDown = true;
		}
	};


	// When user presses lets go of a valid key,
	// change the movement signal to false
	window.onkeyup = function(e) {
		var key = e.which;
		if (key == "87") // 87 = a
		{
			p1.movingUp = false;
		}
		else if (key == "83") // 83 = s
		{
			p1.movingDown = false;
		}
		else if (key == "38") // 38 = Up Arrow
		{
			p2.movingUp = false;
		}
		else if (key == "40") // 40 = Down Arrow
		{
			p2.movingDown = false;
		}

		// Pause
		else if (key == "32") // 32 = Space
		{
			if (betweenGames) {
				newGame();
				betweenGames = false;
			}

			else {
				pause();
			}
		}
	};

};
