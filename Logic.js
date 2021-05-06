let canvas;
let game;

window.onload = function ()
{
	canvas = document.getElementById("Canvas");
	canvas.width = canvas.style.width;
	canvas.height = canvas.style.height;

	game = new Game(canvas);
	game.AddPlayer(new Player(Game.PlayerNames[Math.floor(Math.random() * Game.PlayerNames.length)], '#ABCDEF', "a", "s"));
	game.AddPlayer(new Player(Game.PlayerNames[Math.floor(Math.random() * Game.PlayerNames.length)], '#123456', "ArrowLeft", "ArrowRight"));

	document.onkeydown = (eventArgs) => game.KeyDown(eventArgs);
	document.onkeyup = (eventArgs) => game.KeyUp(eventArgs);
};

function GameUpdateLoop()
{
	if (game.IsRunning)
	{
		game.LastFrameTime = Date.now() - game.LastFrameTimeStamp;
		game.LastFrameTimeStamp = Date.now();
		game.players.forEach(player =>
		{
			if (!player.IsDead)
			{
				player.Update(Math.min(0.016, 1000 / game.LastFrameTime));
				game.IsPlayerDed(player, game.players);
			}
		});
	}

	setTimeout(GameUpdateLoop, 0);
}

function GameRenderLoop()
{
	if (game.ShowFrameRate)
	{
		if (game.LastFrameTime !== 0)
		{
			let FrameRate = Math.round(1000 / game.LastFrameTime);

			game.clearCanvas();
			let textDimensions = game.context.measureText(FrameRate);

			game.context.fillStyle = "#1d881c";
			game.context.fillText(FrameRate, game.canvas.width - textDimensions.width, textDimensions.fontBoundingBoxAscent);
		}
	}

	game.players.forEach(player => game.drawTrail(player));

	//document.getElementById("debugLabel").innerText = game.players[1].untrackedTrailLength;

	window.requestAnimationFrame(GameRenderLoop);
}

function StartGame()
{
	game.Start();
}

class Game
{
	// Constants
	static BaseLineWidth = 4;
	static BaseSpeed = 64;
	static BaseTurnSpeed = 1;
	static TrailStepSize = 10;

	static PlayerNames = [
		"Franz",
		"Sepp",
		"Hugo",
		"Rainer",
		"Karl",
		"Klaus",
		"Kevin",
		"Peter",
		"Balthasar",
		"Hans"
	];


	constructor(canvas)
	{
		this.IsRunning = false;
		this.ShowFrameRate = true;
		this.LastFrameTime = 0;
		this.LastFrameTimeStamp = Date.now();

		this.players = [];

		this.canvas = canvas;
		this.context = canvas.getContext("2d");
		this.SetupCanvasContext(canvas);
	}

	Start()
	{
		if (game.IsRunning)
		{ return; }

		this.players.forEach(player =>
		{
			player.position = new Point(Math.random() * this.canvas.width, Math.random() * this.canvas.height); // TODO: Add logic to not spawn players into one another
			player.CreateInitialTrail();
		});

		setTimeout(GameUpdateLoop, 0);
		window.requestAnimationFrame(GameRenderLoop);
	}

	Pause()
	{
		this.IsRunning = false;
	}

	UnPause()
	{
		this.IsRunning = true;
	}

	IsPlayerDed(player, AllPlayers)
	{
		if (player.position.x < player.size || player.position.x + player.size > this.canvas.width ||
			player.position.y < player.size || player.position.y + player.size > this.canvas.height)
		{
			player.Kill();
			return;
		}
		AllPlayers.forEach(otherPlayer =>
		{
			if (player.IntersectsWithOtherPlayer(otherPlayer)) // TODO: fix
			{
				player.Kill();
			}
		});
	}

	QuitGame()
	{
		this.Quit = true;
	}


	SetupCanvasContext(canvas)
	{
		// Get the device pixel ratio, falling back to 1.
		const devicePixelRatio = window.devicePixelRatio || 1;

		// Get the size of the canvas in CSS pixels.
		const boundingBox = canvas.getBoundingClientRect();

		// Give the canvas pixel dimensions of their CSS
		// size * the device pixel ratio.
		canvas.width = boundingBox.width * devicePixelRatio;
		canvas.height = boundingBox.height * devicePixelRatio;

		// Scale all drawing operations by the devicePixelRatio, so you
		// don't have to worry about the difference.
		this.context.scale(devicePixelRatio, devicePixelRatio);

		this.context.font = "30px Arial";
		this.context.textAlign = "left";
	}

	drawTrail(player)
	{
		this.context.strokeStyle = player.color;
		this.context.lineWidth = 4;

		this.context.beginPath();
		this.context.moveTo(player.trail[0].x, player.trail[0].y);

		for (let i = 1; i < player.trail.length; i++)
		{
			this.context.lineTo(player.trail[i].x, player.trail[i].y);
		}
		this.context.lineTo(player.position.x, player.position.y);

		this.context.stroke();
		this.context.beginPath();
		this.context.fillStyle = player.color;
		this.context.arc(player.position.x, player.position.y, player.size / 2, 0, 2 * Math.PI);
		this.context.fill();
	}

	clearCanvas()
	{
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	KeyDown(keyboardEventArgs)
	{
		if (keyboardEventArgs.code === "Space")
		{
			if (this.IsRunning)
			{ this.Pause(); }
			else
			{ this.UnPause(); }
		}

		this.players.forEach(player =>
		{
			if (keyboardEventArgs.key === player.LeftKey)
			{ player.movingLeft = true; }
			if (keyboardEventArgs.key === player.RightKey)
			{ player.movingRight = true; }
		});
	}

	KeyUp(keyboardEventArgs)
	{
		this.players.forEach(player =>
		{
			if (keyboardEventArgs.key === player.LeftKey)
			{ player.movingLeft = false; }
			if (keyboardEventArgs.key === player.RightKey)
			{ player.movingRight = false; }
		});
	}

	AddPlayer(player)
	{
		this.players.push(player);
	}
}

class Player
{
	constructor(name, color, leftKey, rightKey)
	{
		this.color = color;
		this.LeftKey = leftKey;
		this.RightKey = rightKey;

		this.movingRight = false;
		this.movingLeft = false;

		this.untrackedTrailLength = 0;

		this.IsDead = false;
		this.name = name;

		this.position = new Point(0, 0);
		this.direction = new Point(1, 0);
		this.direction.Rotate(Math.random() * 360);
		this.direction.Normalize();
	}

	CreateInitialTrail()
	{
		this.trail = [Point.Subtract(this.position, this.direction.Multiply(Game.BaseSpeed))];
	}

	Update(deltaTime)
	{
		// TODO: add logic to update player effects

		if (this.IsDead)
		{ return; }

		if (this.movingLeft)
		{ this.direction.Rotate(-Game.BaseTurnSpeed * deltaTime); }
		else if (this.movingRight)
		{ this.direction.Rotate(Game.BaseTurnSpeed * deltaTime); }

		let lastPosition = {x: this.position.x, y: this.position.y};

		this.position.Add(this.direction.Multiply(deltaTime * this.speed));

		let difference = {x: this.position.x - lastPosition.x, y: this.position.y - lastPosition.y};

		this.untrackedTrailLength += difference.x * difference.x + difference.y * difference.y;

		if (this.untrackedTrailLength > Game.TrailStepSize)
		{
			this.trail.push({x: this.position.x, y: this.position.y});
			this.untrackedTrailLength = 0;
		}
	}

	get size()
	{
		return Game.BaseLineWidth;
	}

	get speed()
	{
		return Game.BaseSpeed;
	}

	Kill()
	{
		this.IsDead = true;
		console.log(this.name, "died")
	}

	IntersectsWithOtherPlayer(otherPlayer)
	{
		if (this === otherPlayer)
		{ return false; }

		for (let i = 1; i < otherPlayer.trail.length; i++)
		{
			if (Utilities.DoLineSegmentsIntersect(otherPlayer.trail[i - 1], otherPlayer.trail[i], this.trail[this.trail.length - 1], this.position))
			{ return true; }
		}
		return Utilities.DoLineSegmentsIntersect(otherPlayer.trail[otherPlayer.trail.length - 1], otherPlayer.position, this.trail[this.trail.length - 1], this.position);
	}
}

class Point
{
	constructor(x, y)
	{
		this.x = x;
		this.y = y;
	}

	Multiply(scalar)
	{
		return new Point(this.x * scalar, this.y * scalar);
	}

	Add(point)
	{
		this.x += point.x;
		this.y += point.y;
	}

	Subtract(point)
	{
		this.Add(point.Multiply(-1));
	}

	static Subtract(point1, point2)
	{
		return new Point(point1.x - point2.x, point1.y - point2.y);
	}

	Rotate(angle)
	{
		this.x = Math.cos(angle) * this.x - Math.sin(angle) * this.y;
		this.y = Math.sin(angle) * this.x + Math.cos(angle) * this.y;
	}

	Normalize()
	{
		let length = this.Length();
		this.x /= length;
		this.y /= length;
	}

	Length()
	{
		return Math.sqrt(this.LengthSquared());
	}

	LengthSquared()
	{
		return this.x * this.x + this.y * this.y;
	}
}

class Utilities
{
	// Returns 1 if the lines intersect, otherwise 0.
	// Algorithm taken from: https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect
	static DoLineSegmentsIntersect(point1, point2, point3, point4)
	{
		let intersectionPoint1 = new Point(point2.x - point1.x, point2.y - point1.y);
		let intersectionPoint2 = new Point(point4.x - point3.x, point4.y - point3.y);

		let s = (-intersectionPoint1.y * (point1.x - point3.x) + intersectionPoint1.x * (point1.y - point3.y)) /
			(-intersectionPoint2.x * intersectionPoint1.y + intersectionPoint1.x * intersectionPoint2.y);
		let t = (intersectionPoint2.x * (point1.y - point3.y) - intersectionPoint2.y * (point1.x - point3.x)) /
			(-intersectionPoint2.x * intersectionPoint1.y + intersectionPoint1.x * intersectionPoint2.y);

		return s >= 0 && s <= 1 && t >= 0 && t <= 1;
	}
}
