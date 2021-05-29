let canvas;
let game;

window.onload = function ()
{
	canvas = document.getElementById("Canvas");
	canvas.width = canvas.style.width;
	canvas.height = canvas.style.height;

	game = new Game(canvas);
	game.AddRandomPlayer();
	game.AddRandomPlayer();

	game.context.font = "2em 'Press Start 2P'";

	document.onkeydown = (eventArgs) => game.KeyDown(eventArgs);
	document.onkeyup = (eventArgs) => game.KeyUp(eventArgs);
	document.onmouseup = (eventArgs) => game.MouseUp(eventArgs);
	document.onmousemove = (eventArgs) => game.MouseMove(eventArgs);

	Utilities.CreateImageElements();

	//StartGame();
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
			game.SpawnPowerUp();
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

	if (game.InPlayerSetup)
	{
		game.RenderSetupMenu();
	}
	else
	{
		game.players.forEach(player => game.drawTrail(player));
		game.powerUps.forEach(powerUp => game.DrawPowerup(powerUp));
	}

	window.requestAnimationFrame(GameRenderLoop);
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
	static SetupMenuMargin = 32;

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
		this.InPlayerSetup = true;
		this.ShowFrameRate = true;
		this.LastFrameTime = 0;
		this.LastFrameTimeStamp = Date.now();

		this.players = [];

		this.powerUps = [];
		this.powerUpTimeout = 0;

		this.canvas = canvas;
		this.context = canvas.getContext("2d");
		this.SetupCanvasContext(canvas);

		this.setupMenu = new SetupMenu();

		window.requestAnimationFrame(GameRenderLoop);
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

		this.InPlayerSetup = false;

		this.StartRound();

		this.CreatePlayerScores();

		// for (let i = 0; i < 10; i++) { this.SpawnPowerup(); }

		setTimeout(GameUpdateLoop, 0);
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

	RenderSetupMenu()
	{
		this.setupMenu.Render();
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
			if (this.InPlayerSetup && game.players.length > 1) // TODO: add snake mode if only one player is there
			{ this.Start(); }
			else if (this.RoundEnd)
			{ this.StartRound(); }
			else if (this.IsRunning)
			{ this.Pause(); }
			else
			{ this.UnPause(); }

			return;
		}

		if (this.InPlayerSetup)
		{
			this.setupMenu.KeyDown(keyboardEventArgs);
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

	MouseUp(mouseEventArgs)
	{
		if (!this.InPlayerSetup)
		{ return; }

		this.setupMenu.MouseClick(mouseEventArgs);
	}

	MouseMove(mouseEventArgs)
	{
		if (!this.InPlayerSetup)
		{ return; }

		this.setupMenu.MouseMove(mouseEventArgs);
	}

	AddPlayer(player)
	{
		this.players.push(player);
	}

	AddRandomPlayer()
	{
		this.players.push(new Player(Utilities.GetRandomPlayerName(), Utilities.GetRandomPlayerColor(), Utilities.GetRandomPlayerKey(), Utilities.GetRandomPlayerKey()));
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

	SpawnPowerUp()
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

		this.EditingName = false;
		this.EditingLeftKey = false;
		this.EditingRightKey = false;
		this.EditingColor = false;

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

class SetupMenu
{
	debugDraw = false;

	Render()
	{
		this.renderedObjects = [];

		let Headline = "Setup";

		let textDimensions = game.context.measureText(Headline);

		game.context.fillStyle = "#1d881c";
		this.RenderText(Headline, game.canvas.width / 2 - textDimensions.width / 2, textDimensions.fontBoundingBoxAscent + Game.SetupMenuMargin, "Headline");

		let y = textDimensions.fontBoundingBoxAscent + 5 * Game.SetupMenuMargin;
		let firstColumnX = this.GetSetupMenuColumnWidth();
		let secondColumnX = this.GetSetupMenuColumnWidth(1);
		let thirdColumnX = this.GetSetupMenuColumnWidth(2);
		let forthColumnX = this.GetSetupMenuColumnWidth(3);

		game.context.fillStyle = "#BBBBBB";
		this.RenderText("Name", firstColumnX, y, "Name");
		this.RenderText("Left", secondColumnX, y, "Left");
		this.RenderText("Right", thirdColumnX, y, "Right");


		for (let i = 0; i < game.players.length; i++)
		{
			y += (textDimensions.fontBoundingBoxAscent + Game.SetupMenuMargin);

			game.context.fillStyle = game.players[i].color;
			this.RenderText(game.players[i].name + (game.players[i].EditingName && Date.now() % 1000 < 500 ? "|" : ""),
				firstColumnX, y, "Player_" + game.players[i].name + "_Name");
			this.RenderText(game.players[i].LeftKey + (game.players[i].EditingLeftKey && Date.now() % 1000 < 500 ? "|" : ""),
				secondColumnX, y, "Player_" + game.players[i].name + "_LeftKey");
			this.RenderText(game.players[i].RightKey + (game.players[i].EditingRightKey && Date.now() % 1000 < 500 ? "|" : ""),
				thirdColumnX, y, "Player_" + game.players[i].name + "_RightKey");

			game.context.fillRect(forthColumnX, y - textDimensions.fontBoundingBoxAscent, 2 * Game.SetupMenuMargin, Game.SetupMenuMargin);
			this.renderedObjects["Player_" + game.players[i].name + "_Color"] = {x: forthColumnX, y: y, width: 2 * Game.SetupMenuMargin, height: Game.SetupMenuMargin};

			game.context.fillStyle = "#FF0000";
			this.RenderText("x", forthColumnX + 3 * Game.SetupMenuMargin, y, "Player_" + game.players[i].name + "_Delete");
		}

		game.context.fillStyle = "#00FF00";
		this.RenderText("+", firstColumnX, y + textDimensions.fontBoundingBoxAscent + Game.SetupMenuMargin, "Player_Add");

		if (Utilities.AnyPlayerIsColorPicking())
		{
			this.RenderColorPalette();
		}

		if (this.debugDraw)
		{
			for (const renderedObject in this.renderedObjects)
			{
				let renderedObjectBox = this.renderedObjects[renderedObject];
				game.context.strokeStyle = "#FF0000";
				game.context.beginPath();
				game.context.strokeRect(renderedObjectBox.x, renderedObjectBox.y - renderedObjectBox.height, renderedObjectBox.width, renderedObjectBox.height)
			}

			if (this.mousePositionOnCanvas)
			{
				game.context.fillStyle = "#FF0000";
				game.context.arc(this.mousePositionOnCanvas.x, this.mousePositionOnCanvas.y, 4, 0, 2 * Math.PI);
				game.context.fill();
			}
		}
	}

	RenderText(text, x, y, objectName)
	{
		game.context.fillText(text, x, y);
		let textDimensions = game.context.measureText(text);
		this.renderedObjects[objectName] = {x: x, y: y, width: textDimensions.width, height: textDimensions.fontBoundingBoxAscent};
	}

	RenderColorPalette()
	{
		let stepSize = 256 / (4 - 1);
		let tileSize = ((game.canvas.width - 2 * Game.SetupMenuMargin) - ((game.canvas.width - 2 * Game.SetupMenuMargin) % 32)) / 16;
		let x = Game.SetupMenuMargin, y = Game.SetupMenuMargin, highlightRectangleX = 0, highlightRectangleY = 0, highlightRectangleColor = "";
		let counter = 0;

		for (let r = 0; r <= 256; r += stepSize)
		{
			for (let g = 0; g <= 256; g += stepSize)
			{
				for (let b = 0; b <= 256; b += stepSize)
				{
					let colorText = "rgb(" + r + "," + g + "," + b + ")";
					game.context.fillStyle = colorText;
					game.context.fillRect(x, y, tileSize, tileSize);

					if (this.mousePositionOnCanvas.x > x && this.mousePositionOnCanvas.x < x + tileSize &&
						this.mousePositionOnCanvas.y > y && this.mousePositionOnCanvas.y < y + tileSize)
					{
						highlightRectangleX = x;
						highlightRectangleY = y;
						highlightRectangleColor = "rgb(" + (256 - r) + "," + (256 - g) + "," + (256 - b) + ")";
					}

					this.renderedObjects["Color_" + colorText] = {x: x, y: y + tileSize, width: tileSize, height: tileSize};

					counter++;
					x += tileSize;

					if (x > game.canvas.width - 2 * Game.SetupMenuMargin)
					{
						x = Game.SetupMenuMargin;
						y += tileSize;
					}
				}
			}
		}

		if (highlightRectangleX !== 0)
		{
			game.context.strokeStyle = highlightRectangleColor;
			game.context.lineWidth = 5;
			game.context.strokeRect(highlightRectangleX, highlightRectangleY, tileSize, tileSize);
		}
	}

	GetSetupMenuColumnWidth(index = 0)
	{
		let firstColumnX = 3 * Game.SetupMenuMargin;
		if (index === 0)
		{ return firstColumnX; }

		let longestName = game.context.measureText("Name").width;
		let longestLeftKey = game.context.measureText("Left").width;
		let longestRightKey = game.context.measureText("Right").width;

		game.players.forEach(player =>
		{
			let nameSize = game.context.measureText(player.name);
			let leftKeySize = game.context.measureText(player.LeftKey);
			let rightKeySize = game.context.measureText(player.RightKey);

			if (nameSize.width > longestName)
			{ longestName = nameSize.width; }
			if (leftKeySize.width > longestLeftKey)
			{ longestLeftKey = leftKeySize.width; }
			if (rightKeySize.width > longestRightKey)
			{ longestRightKey = rightKeySize.width; }
		});

		let secondColumnX = firstColumnX + longestName + Game.SetupMenuMargin;
		if (index === 1)
		{ return secondColumnX; }

		let thirdColumnX = secondColumnX + longestLeftKey + Game.SetupMenuMargin;
		if (index === 2)
		{ return thirdColumnX; }

		return thirdColumnX + longestRightKey + Game.SetupMenuMargin;
	}

	MouseClick(mouseEventArgs)
	{
		let anyColorPicking = Utilities.AnyPlayerIsColorPicking();
		let colorPicker = undefined;

		game.players.forEach(player =>
		{
			if (player.EditingColor)
			{ colorPicker = player; }

			player.EditingName = false;
			player.EditingLeftKey = false;
			player.EditingRightKey = false;
			player.EditingColor = false;
		});

		this.mousePositionOnCanvas = {x: mouseEventArgs.x - mouseEventArgs.target.offsetLeft, y: mouseEventArgs.y - mouseEventArgs.target.offsetTop};

		for (const renderedObject in this.renderedObjects)
		{
			let renderedObjectBox = this.renderedObjects[renderedObject];
			if (this.mousePositionOnCanvas.x > renderedObjectBox.x && this.mousePositionOnCanvas.x < renderedObjectBox.x + renderedObjectBox.width &&
				this.mousePositionOnCanvas.y > renderedObjectBox.y - renderedObjectBox.height && this.mousePositionOnCanvas.y < renderedObjectBox.y)
			{
				let objectParts = renderedObject.split('_');

				if (anyColorPicking)
				{
					if (objectParts[0] === "Color" && colorPicker)
					{
						colorPicker.color = objectParts[1];
						colorPicker.EditingColor = false;

						break;
					}
				}
				else if (objectParts[0] === "Player")
				{
					if (objectParts[1] === "Add")
					{
						game.AddRandomPlayer();
					}
					else if (Utilities.GameHasPlayerWithName(objectParts[1]))
					{
						if (objectParts[2] === "Name")
						{ Utilities.GetPlayerWithName(objectParts[1]).EditingName = true; }
						else if (objectParts[2] === "LeftKey")
						{ Utilities.GetPlayerWithName(objectParts[1]).EditingLeftKey = true; }
						else if (objectParts[2] === "RightKey")
						{ Utilities.GetPlayerWithName(objectParts[1]).EditingRightKey = true; }
						else if (objectParts[2] === "Color")
						{ Utilities.GetPlayerWithName(objectParts[1]).EditingColor = true; }
						else if (objectParts[2] === "Delete")
						{ game.players.splice(game.players.indexOf(Utilities.GetPlayerWithName(objectParts[1])), 1); }
					}

					break;
				}
			}
		}
	}

	MouseMove(mouseEventArgs)
	{
		this.mousePositionOnCanvas = {x: mouseEventArgs.x - mouseEventArgs.target.offsetLeft, y: mouseEventArgs.y - mouseEventArgs.target.offsetTop};
	}

	KeyDown(keyboardEventArgs)
	{
		let allowedNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890öäüÖÄÜ-_+-";

		game.players.forEach(player =>
		{
			if (player.EditingName)
			{
				if (keyboardEventArgs.code === "Enter")
				{
					player.EditingName = false;

					if (player.name === "")
					{
						player.name = Utilities.GetRandomPlayerName();
					}
				}
				else if (keyboardEventArgs.code === "Backspace")
				{
					player.name = player.name.slice(0, -1);
				}
				else if (allowedNameCharacters.includes(keyboardEventArgs.key))
				{
					player.name += keyboardEventArgs.key;
				}
			}
			if (player.EditingRightKey)
			{
				player.RightKey = keyboardEventArgs.key;
				player.EditingRightKey = false;
			}
			if (player.EditingLeftKey)
			{
				player.LeftKey = keyboardEventArgs.key;
				player.EditingLeftKey = false;
				player.EditingRightKey = true;
			}
		});
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

		let denominator = intersectionPoint1.x * intersectionPoint2.y - intersectionPoint2.x * intersectionPoint1.y;
		if (denominator === 0)
		{
			return false; // Collinear
		}
		let denominatorPositive = denominator > 0;

		let intersectionPoint3 = new Point(point1.x - point3.x, point1.y - point3.y);
		let s_number = intersectionPoint1.x * intersectionPoint3.y - intersectionPoint1.y * intersectionPoint3.x;
		if ((s_number < 0) === denominatorPositive)
		{
			return 0; // No collision
		}

		let t_number = intersectionPoint2.x * intersectionPoint3.y - intersectionPoint2.y * intersectionPoint3.x;
		if ((t_number < 0) === denominatorPositive || (s_number > denominator) === denominatorPositive || (t_number > denominator) === denominatorPositive)
		{
			return 0; // No collision
		}

		return true;
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

	static GetRandomPlayerColor()
	{
		let color;

		do
		{
			color = "rgb(" + Math.floor(Math.random() * 256) + "," + Math.floor(Math.random() * 256) + "," + Math.floor(Math.random() * 256) + ")";
		}
		while (Utilities.GameHasPlayerWithColor(color));

		return color;
	}

	static GetRandomPlayerKey()
	{
		let key, availableKeys = "abcdefghijklmnopqrstuvwxyz<^1234567890ß´,.-#öäü";

		do
		{
			key = availableKeys[Math.floor(Math.random() * availableKeys.length)];
		}
		while (Utilities.GameHasPlayerWithKeyBinding(key));

		return key;
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

	static GameHasPlayerWithColor(color)
	{
		for (let i = 0; i < game.players.length; i++)
		{
			if (game.players[i].color === color)
			{
				return true;
			}
		}
		return false;
	}

	static GameHasPlayerWithKeyBinding(key)
	{
		for (let i = 0; i < game.players.length; i++)
		{
			if (game.players[i].LeftKey === key || game.players[i].RightKey === key)
			{
				return true;
			}
		}
		return false;
	}

	static GetPlayerWithName(playerName)
	{
		for (let i = 0; i < game.players.length; i++)
		{
			if (game.players[i].name === playerName)
			{
				return game.players[i];
			}
		}
		return undefined;
	}

	static AnyPlayerIsColorPicking()
	{
		for (let i = 0; i < game.players.length; i++)
		{
			if (game.players[i].EditingColor)
			{
				return true;
			}
		}
		return false;
	}
}
