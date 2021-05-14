let canvas;
let game;

window.onload = function ()
{
	canvas = document.getElementById("Canvas");
	canvas.width = canvas.style.width;
	canvas.height = canvas.style.height;

	game = new Game(canvas);
	game.AddPlayer(new Player("Bäm", '#e289b9', "ArrowLeft", "ArrowRight"));
	//game.AddPlayer(new Player("Flo", '#1a4e85', "+", "-"));
	//game.AddPlayer(new Player("Hönning", '#1c7016', "q", "a"));
	//game.AddPlayer(new Player("Bimu", '#ffffff', "y", "x"));
	game.AddPlayer(new Player("Jacky", '#eebc0d', ",", "."));
	//game.AddPlayer(new Player("Mapfi", '#ff0000', "v", "b"));

	document.onkeydown = (eventArgs) => game.KeyDown(eventArgs);
	document.onkeyup = (eventArgs) => game.KeyUp(eventArgs);

	Utilities.CreateImageElements();

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

		game.powerUpTimeout += game.LastFrameTime;
		if (game.powerUpTimeout > game.powerUpSpawnRate)
		{
			game.SpawnPowerup();
			game.powerUpTimeout = 0;
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
	static BaseTurnSpeed = 3;
	static TrailStepSize = 5;
	static PowerUpSize = 16;
	static BasePowerUpSpawnRate = 5000;
	static DrawPowerUpOutlines = false;

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
		this.RoundEnd = false;
		this.ShowFrameRate = true;
		this.LastFrameTime = 0;
		this.LastFrameTimeStamp = Date.now();

		this.players = [];

		this.powerUps = [];
		this.powerUpTimeout = 0;

		this.canvas = canvas;
		this.context = canvas.getContext("2d");
		this.SetupCanvasContext(canvas);
	}

	get powerUpSpawnRate()
	{
		let powerUpSpawnRateReducers = 0;
		this.players.forEach(player => powerUpSpawnRateReducers += player.PowerUpsOfTypeCount(PowerUpTypes.FastPowerUpSpawn));

		return Game.BasePowerUpSpawnRate / (powerUpSpawnRateReducers + 1);
	}

	Start()
	{
		if (game.IsRunning)
		{ return; }

		this.StartRound();

		this.CreatePlayerScores();

		// for (let i = 0; i < 10; i++) { this.SpawnPowerup(); }

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

	NumberOfPlayersAlive()
	{
		let alivePlayerCount = 0;

		for (let player of this.players)
		{
			if (!player.IsDead)
			{ alivePlayerCount++; }
		}

		return alivePlayerCount;
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
		let lastSize = player.trail.length > 0 ? player.trail[0].size : 0;

		for (let i = 0; i < player.trail.length; i++)
		{
			if (lastSize !== player.trail[i].size)
			{
				this.context.stroke();
				this.context.beginPath();
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

		if (Game.DrawPowerUpOutlines)
		{
			this.context.strokeStyle = "#FF0000";
			this.context.arc(powerUp.position.x, powerUp.position.y, Game.PowerUpSize + 0.5, 0, 2 * Math.PI);
			this.context.stroke();
		}

		let sprite = document.getElementById("PowerUpSprite" + powerUp.type).querySelector("img");

		if (!sprite)
		{
			this.context.fillStyle = "#FF00FF";
			this.context.arc(powerUp.position.x, powerUp.position.y, Game.PowerUpSize, 0, 2 * Math.PI);
			this.context.fill();
		}
		else
		{
			this.context.drawImage(sprite, powerUp.position.x - Game.PowerUpSize, powerUp.position.y - Game.PowerUpSize, Game.PowerUpSize * 2, Game.PowerUpSize * 2);
		}
	}

	clearCanvas()
	{
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	KeyDown(keyboardEventArgs)
	{
		if (keyboardEventArgs.code === "Space")
		{
			keyboardEventArgs.preventDefault(); // to prevent auto scrolling to the bottom of the page
			if (this.RoundEnd)
			{ this.StartRound(); }
			else if (this.IsRunning)
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
		this.RoundEnd = false;
		this.ClearBoard();

		this.players.forEach(player =>
		{
			player.IsDead = false;
			player.activePowerUps = [];

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
		this.RoundEnd = true;
		let winner = this.GetFirstLivingPlayer();
		winner.score += this.players.length;
		winner.UpdateScore();

		console.log(winner.name, "won");

		// TODO: display win message
	}

	ClearBoard()
	{
		this.players.forEach(player => player.ClearTrail());
		this.powerUps = [];
	}

	SpawnPowerup()
	{
		let type = Math.floor(Math.random() * 11 + 1);
		this.powerUps.push({
			position: {x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1, y: Math.random() * canvas.height * 0.8 + canvas.height * 0.1},
			type: type,
			duration: type === PowerUpTypes.FastPowerUpSpawn ? 50000 : 5000
		});
	}

	PickupPowerUp(position, playerSize)
	{
		for (let i = 0; i < this.powerUps.length; i++)
		{
			if (Point.Subtract(position, this.powerUps[i].position).LengthSquared() < Game.PowerUpSize * Game.PowerUpSize * 4 - playerSize * playerSize) // TODO: fix
			{
				let pickedUpPowerUp = this.powerUps[i];
				this.powerUps.splice(i, 1);
				return new PowerUp(pickedUpPowerUp.type, pickedUpPowerUp.duration);
			}
		}

		return undefined;
	}

	CreatePlayerScores()
	{
		let playerScoreTemplate = document.getElementById("PlayerScoreTemplate");

		this.players.forEach(player =>
		{
			playerScoreTemplate.content.querySelector(".PlayerNameTag").textContent = player.name;
			playerScoreTemplate.content.querySelector(".PlayerScore").textContent = player.score;

			let templateClone = document.importNode(playerScoreTemplate.content, true);
			templateClone.querySelector(".SinglePlayerScore").id = player.playerScoreCardId;
			document.getElementById("Scoreboard").appendChild(templateClone);

			let playerScoreCanvas = document.getElementById(player.playerScoreCardId).querySelector("canvas");
			let playerScoreCanvasContext = playerScoreCanvas.getContext("2d");
			playerScoreCanvasContext.beginPath();
			playerScoreCanvasContext.fillStyle = player.color;
			playerScoreCanvasContext.arc(playerScoreCanvas.width / 2, playerScoreCanvas.height / 2, playerScoreCanvas.width / 2, 0, 2 * Math.PI);
			playerScoreCanvasContext.fill();
		});
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

		this.score = 0;

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
		if (this.IsDead)
		{ return; }

		this.dashTimeout -= deltaTime;
		if (this.dashTimeout < 0)
		{
			this.AddPowerUp(new PowerUp(PowerUpTypes.Invincible, 150));
			this.dashTimeout = Math.random() * 0.1 + 5;
		}

		this.UpdatePowerUps();

		let reverseSteering = this.PowerUpsOfTypeCount(PowerUpTypes.ReverseSteering) > 0;
		if ((this.movingLeft && !reverseSteering) || (this.movingRight && reverseSteering))
		{ this.direction.Rotate(-Game.BaseTurnSpeed * deltaTime); }
		else if ((this.movingRight && !reverseSteering) || (this.movingLeft && reverseSteering))
		{ this.direction.Rotate(Game.BaseTurnSpeed * deltaTime); }

		this.direction.Normalize();

		let lastPosition = {x: this.position.x, y: this.position.y};

		this.position.Add(this.direction.Multiply(deltaTime * this.speed));
		this.AddPowerUp(game.PickupPowerUp(this.position, this.size));

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

	get playerScoreCardId()
	{
		return "PlayerScore" + this.name;
	}

	Kill()
	{
		this.IsDead = true;
		this.score += game.players.length - game.NumberOfPlayersAlive();
		this.UpdateScore();

		console.log(this.name, "died")
	}

	UpdateScore()
	{
		let scoreCard = document.getElementById(this.playerScoreCardId);
		scoreCard.style.order = this.score;
		scoreCard.querySelector(".PlayerScore").textContent = this.score;
	}

	IntersectsWithOtherPlayer(otherPlayer)
	{
		if (!this.currentTrailSegment)
		{ return false; }

		let iterationTarget = this === otherPlayer ? otherPlayer.trail.length - Math.max(2, (this.size * this.size / Game.TrailStepSize)) : otherPlayer.trail.length;

		let currentTrailSegment;

		for (let i = 0; i < iterationTarget; i++)
		{
			currentTrailSegment = otherPlayer.trail[i];
			if (Utilities.DoLineSegmentsIntersect(currentTrailSegment.startPoint, currentTrailSegment.endPoint, this.currentTrailSegment.startPoint, this.position) ||
				Utilities.distanceToSegmentSquared(this.position, currentTrailSegment) < this.size * this.size)
			{
				return true; // TODO: fix issue, where player kills himself when picking up the thinner powerUp
			}
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
			powerUp.type === PowerUpTypes.Invincible ||
			powerUp.type === PowerUpTypes.ReverseSteering ||
			powerUp.type === PowerUpTypes.FastPowerUpSpawn)
		{
			powerUp.StartUse();
			this.activePowerUps.push(powerUp);
		}


		if (powerUp.type === PowerUpTypes.Invincible && this.currentTrailSegment)
		{
			this.AddTrailSegment(this.currentTrailSegment.startPoint, this.size);
			this.currentTrailSegment = undefined;
		}
		else if (powerUp.type === PowerUpTypes.AllFast)
		{
			this.AddPowerUpToAllOthers(new PowerUp(PowerUpTypes.Fast, powerUp.duration));
		}
		else if (powerUp.type === PowerUpTypes.AllSlow)
		{
			this.AddPowerUpToAllOthers(new PowerUp(PowerUpTypes.Slow, powerUp.duration));
		}
		else if (powerUp.type === PowerUpTypes.AllThick)
		{
			this.AddPowerUpToAllOthers(new PowerUp(PowerUpTypes.Thick, powerUp.duration));
		}
		else if (powerUp.type === PowerUpTypes.AllThin)
		{
			this.AddPowerUpToAllOthers(new PowerUp(PowerUpTypes.Thin, powerUp.duration));
		}
		else if (powerUp.type === PowerUpTypes.AllReverseSteering)
		{
			this.AddPowerUpToAllOthers(new PowerUp(PowerUpTypes.ReverseSteering, powerUp.duration));
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

	AddPowerUpToAllOthers(powerUp)
	{
		game.players.forEach(player =>
		{
			if (player !== this)
			{ player.AddPowerUp(powerUp); }
		});
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
		"ClearScreen": 6,
		"FastPowerUpSpawn": 7,
		"Thick": 8,
		"AllThick": 9,
		"ReverseSteering": 10,
		"AllReverseSteering": 11,
		/*
		"Thin": 12,
		"AllThin": 13,
		/*
		"TeleportWalls": 14,
		"SharpTurn": 15,
		 */
	}
);

class PowerUp
{
	constructor(type, duration = 5000)
	{
		this.duration = duration;
		this.type = type;
	}

	StartUse()
	{
		this.startTime = Date.now();
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

	// Algorithm taken from: https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
	static distanceToSegmentSquared(point, lineSegment)
	{
		let lineSegmentLengthSquared = Point.Subtract(lineSegment.startPoint, lineSegment.endPoint).LengthSquared();

		if (lineSegmentLengthSquared === 0)
		{ return Point.Subtract(point, lineSegment.startPoint).LengthSquared(); }

		let t = ((point.x - lineSegment.startPoint.x) * (lineSegment.endPoint.x - lineSegment.startPoint.x) +
			(point.y - lineSegment.startPoint.y) * (lineSegment.endPoint.y - lineSegment.startPoint.y)) / lineSegmentLengthSquared;

		t = Math.max(0, Math.min(1, t));

		return Point.Subtract(point, {
			x: lineSegment.startPoint.x + t * (lineSegment.endPoint.x - lineSegment.startPoint.x),
			y: lineSegment.startPoint.y + t * (lineSegment.endPoint.y - lineSegment.startPoint.y)
		}).LengthSquared();
	}

	static CreateImageElements()
	{
		const sprites = [
			{url: "./Sprites/FasterOthers.png", powerUpId: 3, description: "Makes all others faster"},
			{url: "./Sprites/FasterSelf.png", powerUpId: 2, description: "Makes you faster"},
			{url: "./Sprites/SlowerOthers.png", powerUpId: 5, description: "Makes all others slower"},
			{url: "./Sprites/SlowerSelf.png", powerUpId: 4, description: "Makes you slower"},
			{url: "./Sprites/ThickerOthers.png", powerUpId: 9, description: "Makes all others thicker"},
			{url: "./Sprites/ThickerSelf.png", powerUpId: 8, description: "Makes you thicker"},
			{url: "./Sprites/ThinnerOthers.png", powerUpId: 13, description: "Makes all others thinner"},
			{url: "./Sprites/ThinnerSelf.png", powerUpId: 12, description: "Makes you thinner"},
			{url: "./Sprites/FasterPowerUpSpawn.png", powerUpId: 7, description: "Makes power-ups spawn faster"},
			{url: "./Sprites/ClearBoard.png", powerUpId: 6, description: "Clears the board from all lines and power-ups"},
			{url: "./Sprites/Invincible.png", powerUpId: 1, description: "Makes you invincible for some time"},
			{url: "./Sprites/ReverseSteeringSelf.png", powerUpId: 10, description: "Inverts your steering"},
			{url: "./Sprites/ReverseSteeringOthers.png", powerUpId: 11, description: "Inverts the steering of all other players"},
		];

		sprites.forEach(spriteUrl => this.CreateSingleSprite(spriteUrl));
	}

	static CreateSingleSprite(spriteUrl)
	{
		let spriteId = "PowerUpSprite" + spriteUrl.powerUpId;
		let powerUpTemplate = document.getElementById("PowerUpListItemTemplate");
		let powerUpListItem = powerUpTemplate.content.querySelector("li");

		powerUpTemplate.content.querySelector("div").textContent = spriteUrl.description;
		powerUpListItem.id = spriteId;

		let templateClone = document.importNode(powerUpTemplate.content, true);

		let sprite = new Image(Game.PowerUpSize * 2, Game.PowerUpSize * 2);
		sprite.id = "PowerUpSprite" + spriteUrl.powerUpId;
		sprite.src = spriteUrl.url;

		document.getElementById("PowerUpList").appendChild(templateClone);
		document.getElementById(spriteId).insertBefore(sprite, document.getElementById(spriteId).firstChild);
	}

	static GetRandomPlayerName()
	{
		let playerName;

		do
		{
			playerName = Game.PlayerNames[Math.floor(Math.random() * Game.PlayerNames.length)];
		}
		while (Utilities.GameHasPlayerWithName(playerName));

		return playerName;
	}

	static GameHasPlayerWithName(playerName)
	{
		for (let i = 0; i < game.players.length; i++)
		{
			if (game.players[i].name === playerName)
			{
				return true;
			}
		}
		return false;
	}
}
