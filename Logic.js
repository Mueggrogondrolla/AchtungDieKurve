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

	StartGame();
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
				player.Update(Math.min(0.016, game.LastFrameTime / 1000));
				game.IsPlayerDed(player, game.players);
			}
		});

		game.powerUpTimeout -= game.LastFrameTime;
		if (game.powerUpTimeout < 0)
		{
			game.SpawnPowerup();
			game.powerUpTimeout = Math.random() * 100 + 5000;
		}
	}

	setTimeout(GameUpdateLoop, 0);
}

function GameRenderLoop()
{
	game.clearCanvas();

	if (game.ShowFrameRate)
	{
		if (game.LastFrameTime !== 0)
		{
			let FrameRate = Math.round(1000 / game.LastFrameTime);

			let textDimensions = game.context.measureText(FrameRate);

			game.context.fillStyle = "#1d881c";
			game.context.fillText(FrameRate, game.canvas.width - textDimensions.width, textDimensions.fontBoundingBoxAscent);
		}
	}

	game.players.forEach(player => game.drawTrail(player));
	game.powerUps.forEach(powerUp => game.DrawPowerup(powerUp));

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
	static BaseSpeed = 128;
	static BaseTurnSpeed = 2;
	static TrailStepSize = 5;
	static PowerUpSize = 16;

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

		this.powerUps = [];
		this.powerUpTimeout = 5000;

		this.canvas = canvas;
		this.context = canvas.getContext("2d");
		this.SetupCanvasContext(canvas);
	}

	Start()
	{
		if (game.IsRunning)
		{ return; }

		this.StartRound();

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
			this.KillPlayer(player);
			return;
		}
		AllPlayers.forEach(otherPlayer =>
		{
			if (player.IntersectsWithOtherPlayer(otherPlayer))
			{
				this.KillPlayer(player);
			}
		});
	}

	KillPlayer(player)
	{
		player.Kill();

		if (this.OnlyOnePlayerLeft())
		{ this.EndRound(); }
	}

	OnlyOnePlayerLeft()
	{
		let firstAlivePlayerFound = false;

		for (let player of this.players)
		{
			if (!player.IsDead)
			{
				if (firstAlivePlayerFound)
				{ return false; }
				firstAlivePlayerFound = true;
			}
		}

		return firstAlivePlayerFound;
	}

	GetFirstLivingPlayer()
	{
		for (let player of this.players)
		{
			if (!player.IsDead)
			{
				return player;
			}
		}

		return undefined;
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

		this.context.beginPath();
		let lastSize = player.trail[0].size;

		for (let i = 0; i < player.trail.length; i++)
		{
			if (lastSize !== player.trail[i].size)
			{
				this.context.stroke();
				lastSize = player.trail[i].size;
			}
			this.context.lineWidth = player.trail[i].size;
			this.context.moveTo(player.trail[i].startPoint.x, player.trail[i].startPoint.y);
			this.context.lineTo(player.trail[i].endPoint.x, player.trail[i].endPoint.y);
		}
		if (player.currentTrailSegment)
		{
			this.context.lineWidth = player.currentTrailSegment.size;
			this.context.moveTo(player.currentTrailSegment.startPoint.x, player.currentTrailSegment.startPoint.y);
			this.context.lineTo(player.position.x, player.position.y);
		}
		this.context.stroke();

		this.context.beginPath();
		this.context.fillStyle = '#FFFFFF';
		this.context.arc(player.position.x, player.position.y, player.size / 2, 0, 2 * Math.PI);
		this.context.fill();
	}

	DrawPowerup(powerUp)
	{
		this.context.beginPath();
		this.context.fillStyle = this.GetPowerUpSprite(powerUp);
		this.context.arc(powerUp.position.x, powerUp.position.y, Game.PowerUpSize, 0, 2 * Math.PI);
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

	StartRound()
	{
		this.ClearBoard();

		this.players.forEach(player =>
		{
			let playerTooCloseToOtherPlayer;

			do
			{
				playerTooCloseToOtherPlayer = false;

				player.position = new Point(Math.random() * this.canvas.width, Math.random() * this.canvas.height);

				this.players.forEach(otherPlayer =>
				{
					if (otherPlayer !== player && Point.Subtract(otherPlayer.position, player.position).Length() < 100)
					{
						playerTooCloseToOtherPlayer = true;
					}
				});
			}
			while (player.position.x < canvas.width * 0.2 || player.position.x > canvas.width * 0.8 ||
			player.position.y < canvas.height * 0.2 || player.position.y > canvas.height * 0.8 || playerTooCloseToOtherPlayer);

			player.CreateInitialTrail();
		});
	}

	EndRound()
	{
		this.IsRunning = false;
		console.log(this.GetFirstLivingPlayer().name, "won");

		// TODO: display win message

		setTimeout(this.StartRound, 5000); // probably wont work
	}

	ClearBoard()
	{
		//this.players.forEach(player => player.ClearTrail());

		// TODO: clear powerups
	}

	SpawnPowerup()
	{
		this.powerUps.push({
			position: {x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1, y: Math.random() * canvas.height * 0.8 + canvas.height * 0.1},
			//type: Math.floor(Math.random() * 13),
			type: PowerUpTypes.Invincible,
			duration: 5000
		});
	}

	GetPowerUpSprite(powerUp)
	{
		if (powerUp.type === PowerUpTypes.Invincible)
		{ return "#FF0000"; }
		if (powerUp.type === PowerUpTypes.Fast)
		{ return "#FF00FF"; }
		if (powerUp.type === PowerUpTypes.AllFast)
		{ return "#FFFF00"; }
		if (powerUp.type === PowerUpTypes.Slow)
		{ return "#00FFFF"; }
		if (powerUp.type === PowerUpTypes.AllSlow)
		{ return "#AAAAAA"; }
		if (powerUp.type === PowerUpTypes.Thick)
		{ return "#FFFFFF"; }
		if (powerUp.type === PowerUpTypes.AllThick)
		{ return "#AAA000"; }
		if (powerUp.type === PowerUpTypes.Thin)
		{ return "#000AAA"; }
		if (powerUp.type === PowerUpTypes.AllThin)
		{ return "#123456"; }
		if (powerUp.type === PowerUpTypes.ClearScreen)
		{ return "#789ABC"; }
		if (powerUp.type === PowerUpTypes.TeleportWalls)
		{ return "#DEF012"; }
		if (powerUp.type === PowerUpTypes.SharpTurn)
		{ return "#0F1E2D"; }
		if (powerUp.type === PowerUpTypes.FastPowerUpSpawn)
		{ return "#F0E1D2"; }
	}

	PickupPowerUp(position)
	{
		for (let i = 0; i < this.powerUps.length; i++)
		{
			if (Point.Subtract(position, this.powerUps[i].position).LengthSquared() < Game.PowerUpSize * Game.PowerUpSize)
			{
				let pickedUpPowerUp = this.powerUps[i];
				this.powerUps.splice(i, 1);
				return pickedUpPowerUp;
			}
		}

		return undefined;
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
		this.currentTrailSegment = undefined;

		this.IsDead = false;
		this.name = name;

		this.activePowerUps = [];

		this.dashTimeout = 5;

		this.position = new Point(0, 0);
		this.direction = new Point(1, 0);
		this.direction.Rotate(Math.random() * 360);
		this.direction.Normalize();

		this.ClearTrail();
	}

	CreateInitialTrail()
	{
		this.AddTrailSegment(Point.Subtract(this.position, this.direction.Multiply(Game.BaseSpeed)), this.size);
	}

	Update(deltaTime)
	{
		this.dashTimeout -= deltaTime;
		if (this.dashTimeout < 0)
		{
			this.AddPowerUp(new PowerUp(PowerUpTypes.Invincible, 150));
			this.dashTimeout = Math.random() * 0.1 + 5;
		}

		this.UpdatePowerUps();

		if (this.IsDead)
		{ return; }

		if (this.movingLeft)
		{ this.direction.Rotate(-Game.BaseTurnSpeed * deltaTime); }
		else if (this.movingRight)
		{ this.direction.Rotate(Game.BaseTurnSpeed * deltaTime); }

		let lastPosition = {x: this.position.x, y: this.position.y};

		this.position.Add(this.direction.Multiply(deltaTime * this.speed));
		this.AddPowerUp(game.PickupPowerUp(this.position));

		let difference = {x: this.position.x - lastPosition.x, y: this.position.y - lastPosition.y};

		this.untrackedTrailLength += difference.x * difference.x + difference.y * difference.y;

		if (this.currentTrailSegment && this.untrackedTrailLength > Game.TrailStepSize)
		{
			this.AddTrailSegment(this.currentTrailSegment.startPoint, this.size);
			this.untrackedTrailLength = 0;
		}
	}

	get size()
	{
		return Game.BaseLineWidth * (1 + this.PowerUpsOfTypeCount(PowerUpTypes.Thick)) / (1 + this.PowerUpsOfTypeCount(PowerUpTypes.Thin));
	}

	get speed()
	{
		return Game.BaseSpeed * (1 + this.PowerUpsOfTypeCount(PowerUpTypes.Fast)) / (1 + this.PowerUpsOfTypeCount(PowerUpTypes.Slow));
	}

	Kill()
	{
		this.IsDead = true;
		console.log(this.name, "died")
	}

	IntersectsWithOtherPlayer(otherPlayer)
	{
		if (!this.currentTrailSegment)
		{ return false; }

		let iterationTarget = this === otherPlayer ? otherPlayer.trail.length - 2 : otherPlayer.trail.length;

		// TODO: check not only for intersections, but also for being closer to another line than lineWidth (as that would also cross the other line visually)
		for (let i = 0; i < iterationTarget; i++)
		{
			if (Utilities.DoLineSegmentsIntersect(otherPlayer.trail[i].startPoint, otherPlayer.trail[i].endPoint, this.currentTrailSegment.startPoint, this.position))
			{ return true; }
		}
		return this === otherPlayer || !otherPlayer.currentTrailSegment ?
			false :
			Utilities.DoLineSegmentsIntersect(otherPlayer.currentTrailSegment.startPoint, otherPlayer.position, this.currentTrailSegment.startPoint, this.position);
	}

	AddTrailSegment(startPoint, size)
	{
		this.trail.push({startPoint: startPoint, endPoint: {x: this.position.x, y: this.position.y}, size: size});
		this.currentTrailSegment = {startPoint: {x: this.position.x, y: this.position.y}, endPoint: undefined, size: this.size};
	}

	ClearTrail()
	{
		this.trail = [];
	}

	UpdatePowerUps()
	{
		for (let i = 0; i < this.activePowerUps.length; i++)
		{
			if (Date.now() - this.activePowerUps[i].startTime > this.activePowerUps[i].duration)
			{
				this.RemovePowerUp(this.activePowerUps[i]);
				i--;
			}
		}
	}

	AddPowerUp(powerUp)
	{
		if (!powerUp)
		{ return; }


		// if it is an active effect on the player, push it on the power up stack
		if (powerUp.type === PowerUpTypes.Thin ||
			powerUp.type === PowerUpTypes.Thick ||
			powerUp.type === PowerUpTypes.Slow ||
			powerUp.type === PowerUpTypes.Fast ||
			powerUp.type === PowerUpTypes.Invincible)
		{
			powerUp.startTime = Date.now();
			this.activePowerUps.push(powerUp);
		}


		if (powerUp.type === PowerUpTypes.Invincible && this.currentTrailSegment)
		{
			this.AddTrailSegment(this.currentTrailSegment.startPoint, this.size);
			this.currentTrailSegment = undefined;
		}
		else if (powerUp.type === PowerUpTypes.AllFast)
		{
			game.players.forEach(player =>
			{
				if (player !== this)
				{ player.AddPowerUp(new PowerUp(PowerUpTypes.Fast, powerUp.duration)); }
			});
		}
		else if (powerUp.type === PowerUpTypes.AllSlow)
		{
			game.players.forEach(player =>
			{
				if (player !== this)
				{ player.AddPowerUp(new PowerUp(PowerUpTypes.Slow, powerUp.duration)); }
			});
		}
		else if (powerUp.type === PowerUpTypes.AllThick)
		{
			game.players.forEach(player =>
			{
				if (player !== this)
				{ player.AddPowerUp(new PowerUp(PowerUpTypes.Thick, powerUp.duration)); }
			});
		}
		else if (powerUp.type === PowerUpTypes.AllThin)
		{
			game.players.forEach(player =>
			{
				if (player !== this)
				{ player.AddPowerUp(new PowerUp(PowerUpTypes.Thin, powerUp.duration)); }
			});
		}
		else if ((powerUp.type === PowerUpTypes.Thick || powerUp.type === PowerUpTypes.Thin) && this.currentTrailSegment)
		{
			this.AddTrailSegment(this.currentTrailSegment.startPoint, this.currentTrailSegment.size);
		}
		else if (powerUp.type === PowerUpTypes.ClearScreen)
		{
			game.ClearBoard();
		}
	}

	RemovePowerUp(powerUp)
	{
		this.activePowerUps.splice(this.activePowerUps.indexOf(powerUp), 1);

		if (powerUp.type === PowerUpTypes.Invincible)
		{
			this.currentTrailSegment = new TrailSegment({x: this.position.x, y: this.position.y}, undefined, this.size);
			this.untrackedTrailLength = 0;
		}
		else if ((powerUp.type === PowerUpTypes.Thick || powerUp.type === PowerUpTypes.Thin) && this.currentTrailSegment)
		{
			this.AddTrailSegment(this.currentTrailSegment.startPoint, this.currentTrailSegment.size);
		}
	}

	PowerUpsOfTypeCount(powerUpType)
	{
		let count = 0;

		for (let i = 0; i < this.activePowerUps.length; i++)
		{
			if (this.activePowerUps[i].type === powerUpType)
			{ count++; }
		}

		return count;
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

class TrailSegment
{
	constructor(startPoint, endPoint, size)
	{
		this.startPoint = startPoint;
		this.endPoint = endPoint;
		this.size = size;
	}
}

const PowerUpTypes = Object.freeze(
	{
		"Invincible": 1,
		"Fast": 2,
		"AllFast": 3,
		"Slow": 4,
		"AllSlow": 5,
		"Thick": 6,
		"AllThick": 7,
		"Thin": 8,
		"AllThin": 9,
		"ClearScreen": 10,
		"TeleportWalls": 11,
		"SharpTurn": 12,
		"FastPowerUpSpawn": 13
	}
);

class PowerUp
{
	constructor(type, duration)
	{
		this.duration = duration;
		this.startTime = Date.now();
		this.type = type; // TODO: make some sophisticated system
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
