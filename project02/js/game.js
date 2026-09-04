/**
 * 小蜜蜂遊戲主核心引擎 (Galaga Game Engine)
 */

// 遊戲狀態常數
const STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  WAVECLEAR: 'WAVECLEAR',
  GAMEOVER: 'GAMEOVER'
};

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 固定虛擬解析度 (保證所有螢幕尺寸下的遊戲體驗一致)
    this.width = 600;
    this.height = 800;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // 遊戲狀態與基本數據
    this.state = STATE.MENU;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('galaga_highscore') || '0', 10);
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.frameCount = 0;
    this.screenShake = 0;
    this.screenFlash = 0;

    // 實體集合
    this.player = null;
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.stars = [];

    // 編隊與俯衝系統控制
    this.formationX = 0;
    this.formationDir = 1;
    this.formationSpeed = 0.8;
    this.diveTimer = 0;
    this.diveInterval = 180; // 每幾幀發起一次俯衝

    // 輸入狀態
    this.keys = {
      left: false,
      right: false,
      fire: false,
      bomb: false
    };
    this.touchControl = {
      active: false,
      targetX: null
    };

    // 綁定事件監聽
    this.initStars();
    this.initInputs();
    this.updateHUD();

    // 啟動主循環
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  // 初始化星空背景
  initStars() {
    this.stars = [];
    const starCount = 120;
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 0.3 + Math.random() * 2.2,
        size: Math.random() < 0.7 ? 1 : (Math.random() < 0.9 ? 2 : 3),
        color: ['#ffffff', '#88ccff', '#ffddaa', '#aaffff'][Math.floor(Math.random() * 4)],
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  // 初始化鍵盤與觸控事件
  initInputs() {
    window.addEventListener('keydown', (e) => {
      soundCtrl.init();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'Space' || e.code === 'KeyK' || e.code === 'KeyJ') this.keys.fire = true;
      if (e.code === 'KeyB' || e.code === 'KeyX') this.triggerBomb();
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'Enter' && this.state === STATE.MENU) this.startGame();
      if (e.code === 'Enter' && this.state === STATE.GAMEOVER) this.restartGame();
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
      if (e.code === 'Space' || e.code === 'KeyK' || e.code === 'KeyJ') this.keys.fire = false;
    });

    // 滑鼠與觸控操作支援
    const handlePointerMove = (e) => {
      if (this.state !== STATE.PLAYING) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      this.touchControl.targetX = (clientX - rect.left) * scaleX;
      this.touchControl.active = true;
    };

    this.canvas.addEventListener('mousemove', handlePointerMove);
    this.canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    this.canvas.addEventListener('touchstart', (e) => {
      soundCtrl.init();
      handlePointerMove(e);
      this.keys.fire = true;
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => {
      this.touchControl.active = false;
      this.keys.fire = false;
    });

    // UI 按鈕綁定
    const btnStart = document.getElementById('btnStart');
    if (btnStart) btnStart.addEventListener('click', () => { soundCtrl.init(); this.startGame(); });

    const btnRestart = document.getElementById('btnRestart');
    if (btnRestart) btnRestart.addEventListener('click', () => { soundCtrl.init(); this.restartGame(); });

    const btnResume = document.getElementById('btnResume');
    if (btnResume) btnResume.addEventListener('click', () => { soundCtrl.init(); this.togglePause(); });

    const btnSound = document.getElementById('btnSound');
    if (btnSound) btnSound.addEventListener('click', () => this.toggleMute());

    // 手機螢幕虛擬按鈕
    const vLeft = document.getElementById('vLeft');
    const vRight = document.getElementById('vRight');
    const vFire = document.getElementById('vFire');
    const vBomb = document.getElementById('vBomb');

    const bindTouchBtn = (elem, pressAction, releaseAction) => {
      if (!elem) return;
      elem.addEventListener('touchstart', (e) => { e.preventDefault(); soundCtrl.init(); pressAction(); });
      elem.addEventListener('touchend', (e) => { e.preventDefault(); releaseAction(); });
      elem.addEventListener('mousedown', (e) => { e.preventDefault(); soundCtrl.init(); pressAction(); });
      elem.addEventListener('mouseup', (e) => { e.preventDefault(); releaseAction(); });
    };

    bindTouchBtn(vLeft, () => this.keys.left = true, () => this.keys.left = false);
    bindTouchBtn(vRight, () => this.keys.right = true, () => this.keys.right = false);
    bindTouchBtn(vFire, () => this.keys.fire = true, () => this.keys.fire = false);
    bindTouchBtn(vBomb, () => this.triggerBomb(), () => {});
  }

  toggleMute() {
    const isMuted = soundCtrl.toggleMute();
    const btnSound = document.getElementById('btnSound');
    if (btnSound) {
      btnSound.innerHTML = isMuted ? '🔇 <span class="nav-text">靜音</span>' : '🔊 <span class="nav-text">音效</span>';
    }
    this.addFloatingText(this.width / 2, 40, isMuted ? 'MUTE ON' : 'SOUND ON', '#ffff00');
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      document.getElementById('pauseOverlay').classList.remove('hidden');
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      document.getElementById('pauseOverlay').classList.add('hidden');
    }
  }

  // 開始新遊戲
  startGame() {
    this.score = 0;
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.player = new Player(this);
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.createWave(this.wave);

    this.state = STATE.PLAYING;
    this.hideAllOverlays();
    this.updateHUD();
  }

  // 重新開始遊戲
  restartGame() {
    this.startGame();
  }

  hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
  }

  // 生成指定關卡的敵機編隊
  createWave(waveNum) {
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.formationX = 0;
    this.formationDir = 1;
    this.formationSpeed = Math.min(0.8 + waveNum * 0.15, 2.5);
    this.diveInterval = Math.max(70, 180 - waveNum * 12);
    this.diveTimer = 60; // 進入新關卡時先給玩家一點緩衝

    // 陣列配置：
    // 第 1 排: 蜂王 (Boss Queen) x 4
    // 第 2~3 排: 突擊蜂 (Red Guard) x 8
    // 第 4~5 排: 工蜂 (Yellow/Green Drone) x 8
    const cols = 8;
    const startY = 90;
    const spacingX = 52;
    const spacingY = 40;
    const offsetX = (this.width - (cols - 1) * spacingX) / 2;

    // 蜂王數量隨波次增加 (最多 6 隻)
    const bossCount = Math.min(4 + Math.floor(waveNum / 2), 6);
    const bossOffsetX = (this.width - (bossCount - 1) * 70) / 2;

    for (let i = 0; i < bossCount; i++) {
      const homeX = bossOffsetX + i * 70;
      const homeY = startY;
      const boss = new Enemy(this, homeX, homeY, 'boss', waveNum);
      this.enemies.push(boss);
    }

    // 突擊蜂 (第 2, 3 排)
    for (let row = 1; row <= 2; row++) {
      for (let col = 0; col < cols; col++) {
        const homeX = offsetX + col * spacingX;
        const homeY = startY + row * spacingY;
        const guard = new Enemy(this, homeX, homeY, 'guard', waveNum);
        this.enemies.push(guard);
      }
    }

    // 工蜂 (第 4, 5 排)
    for (let row = 3; row <= 4; row++) {
      for (let col = 0; col < cols; col++) {
        const homeX = offsetX + col * spacingX;
        const homeY = startY + row * spacingY;
        const drone = new Enemy(this, homeX, homeY, 'drone', waveNum);
        this.enemies.push(drone);
      }
    }

    this.addFloatingText(this.width / 2, this.height / 2 - 40, `STAGE ${waveNum}`, '#00ffff', 40);
  }

  // 釋放全螢幕炸彈
  triggerBomb() {
    if (this.state !== STATE.PLAYING || !this.player || this.player.bombs <= 0) return;

    this.player.bombs--;
    soundCtrl.playBomb();
    this.screenFlash = 15;
    this.screenShake = 20;

    // 清除畫面上所有敵方子彈
    this.enemyBullets = [];

    // 對畫面上所有敵機造成重創
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.takeDamage(10);
    }

    this.addFloatingText(this.player.x, this.player.y - 40, '⚡ EMP BLAST! ⚡', '#ff9900', 25);
    this.updateHUD();
  }

  // 增加分數
  addScore(pts, x, y, isDiving = false) {
    let multiplier = 1;
    if (this.combo > 0) {
      multiplier = Math.min(1 + Math.floor(this.combo / 4), 5);
    }
    if (isDiving) {
      pts *= 2; // 俯衝中被擊破獎勵翻倍
    }

    const finalPts = pts * multiplier;
    this.score += finalPts;

    // 連擊計時刷新
    this.combo++;
    this.comboTimer = 160; // 約 2.6 秒

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('galaga_highscore', this.highScore);
    }

    // 飄浮分數提示
    if (x !== undefined && y !== undefined) {
      const txt = multiplier > 1 ? `+${finalPts} (x${multiplier})` : `+${finalPts}`;
      const color = isDiving ? '#ffdd00' : (multiplier > 1 ? '#00ffff' : '#ffffff');
      this.addFloatingText(x, y, txt, color, 14);
    }

    this.updateHUD();
  }

  // 產生爆炸粒子
  createExplosion(x, y, count = 20, color = null, speedMult = 1) {
    const colors = color ? [color] : ['#ff2a5f', '#ff9900', '#ffff00', '#00ffff', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = (1 + Math.random() * 4.5) * speedMult;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        size: 2 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 25 + Math.random() * 20
      });
    }
  }

  // 掉落道具
  dropPowerup(x, y) {
    const r = Math.random();
    let type = 'multi';
    if (r < 0.35) type = 'multi';
    else if (r < 0.6) type = 'shield';
    else if (r < 0.8) type = 'bomb';
    else if (r < 0.92) type = 'speed';
    else type = 'life';

    this.powerups.push(new PowerUp(x, y, type));
  }

  // 飄浮文字
  addFloatingText(x, y, text, color = '#ffffff', fontSize = 16) {
    this.floatingTexts.push({
      x: x,
      y: y,
      text: text,
      color: color,
      fontSize: fontSize,
      alpha: 1,
      vy: -1.2,
      life: 0,
      maxLife: 45
    });
  }

  // 更新 HUD 介面
  updateHUD() {
    const elScore = document.getElementById('hudScore');
    const elHigh = document.getElementById('hudHighScore');
    const elWave = document.getElementById('hudWave');
    const elBombs = document.getElementById('hudBombs');
    const elLives = document.getElementById('hudLives');

    if (elScore) elScore.innerText = this.score.toString().padStart(6, '0');
    if (elHigh) elHigh.innerText = this.highScore.toString().padStart(6, '0');
    if (elWave) elWave.innerText = this.wave;
    if (elBombs) elBombs.innerText = '💣'.repeat(this.player ? this.player.bombs : 0);

    if (elLives && this.player) {
      elLives.innerHTML = '';
      for (let i = 0; i < this.player.lives; i++) {
        const shipIcon = document.createElement('span');
        shipIcon.className = 'life-icon';
        shipIcon.innerHTML = '🚀';
        elLives.appendChild(shipIcon);
      }
    }
  }

  // 遊戲主循環
  loop(currentTime) {
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    this.frameCount++;

    this.update();
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  // 更新邏輯
  update() {
    // 星空背景推進
    const warpMult = this.state === STATE.WAVECLEAR ? 5 : 1;
    this.stars.forEach(star => {
      star.y += star.speed * warpMult;
      if (star.y > this.height) {
        star.y = 0;
        star.x = Math.random() * this.width;
      }
    });

    if (this.screenShake > 0) this.screenShake--;
    if (this.screenFlash > 0) this.screenFlash--;

    // 粒子系統更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      p.alpha = 1 - (p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 飄浮文字更新
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life++;
      ft.alpha = 1 - (ft.life / ft.maxLife);
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    if (this.state !== STATE.PLAYING && this.state !== STATE.WAVECLEAR) return;

    // 連擊冷卻倒數
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // 玩家邏輯
    if (this.player) {
      this.player.update();
    }

    // 道具拾取與掉落更新
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pup = this.powerups[i];
      pup.update();
      if (pup.y > this.height + 30) {
        this.powerups.splice(i, 1);
        continue;
      }

      // 與玩家碰撞
      if (this.player && this.player.isAlive) {
        const dist = Math.hypot(pup.x - this.player.x, pup.y - this.player.y);
        if (dist < (pup.size / 2 + this.player.width / 2)) {
          this.player.applyPowerup(pup.type);
          this.powerups.splice(i, 1);
        }
      }
    }

    // 編隊整體左右橫移擺動
    this.formationX += this.formationDir * this.formationSpeed;
    if (Math.abs(this.formationX) > 45) {
      this.formationDir *= -1;
    }

    // 俯衝發動排程
    if (this.state === STATE.PLAYING && this.enemies.length > 0) {
      this.diveTimer++;
      if (this.diveTimer >= this.diveInterval) {
        this.diveTimer = 0;
        this.launchDiveSquad();
      }
    }

    // 敵機邏輯更新
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update();
    }

    // 玩家子彈更新與碰撞檢測
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.y += b.vy;
      b.x += b.vx;

      // 飛出畫面外
      if (b.y < -20 || b.x < -20 || b.x > this.width + 20) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // 檢查是否命中敵機
      let bulletRemoved = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (!enemy.isAlive) continue;

        const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
        if (dist < enemy.size * 0.6) {
          enemy.takeDamage(b.damage);
          this.createExplosion(b.x, b.y, 6, '#00ffff', 0.5);
          bulletRemoved = true;
          break;
        }
      }

      if (bulletRemoved) {
        this.playerBullets.splice(i, 1);
      }
    }

    // 敵方子彈更新與碰撞檢測
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx;
      eb.y += eb.vy;

      if (eb.y > this.height + 20 || eb.x < -20 || eb.x > this.width + 20) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // 與玩家碰撞
      if (this.player && this.player.isAlive && !this.player.isInvulnerable) {
        // 如果玩家有護盾
        if (this.player.shield > 0) {
          const dist = Math.hypot(eb.x - this.player.x, eb.y - this.player.y);
          if (dist < this.player.shieldRadius) {
            this.player.hitShield();
            this.enemyBullets.splice(i, 1);
            this.createExplosion(eb.x, eb.y, 8, '#00ffcc', 0.8);
            continue;
          }
        }

        const dist = Math.hypot(eb.x - this.player.x, eb.y - this.player.y);
        if (dist < this.player.width * 0.35) {
          this.player.die();
          this.enemyBullets.splice(i, 1);
        }
      }
    }

    // 檢查關卡是否全部清除
    if (this.state === STATE.PLAYING && this.enemies.length === 0) {
      this.state = STATE.WAVECLEAR;
      soundCtrl.playWaveClear();
      this.addFloatingText(this.width / 2, this.height / 2 - 20, 'STAGE CLEAR!', '#00ff88', 35);
      this.addScore(1000 * this.wave, this.width / 2, this.height / 2 + 20);

      setTimeout(() => {
        if (this.state === STATE.WAVECLEAR) {
          this.wave++;
          this.createWave(this.wave);
          this.state = STATE.PLAYING;
          this.updateHUD();
        }
      }, 2500);
    }
  }

  // 組織俯衝小隊 (經典 Galaga: 蜂王帶護衛突擊蜂出擊)
  launchDiveSquad() {
    const formationEnemies = this.enemies.filter(e => e.diveState === 'formation');
    if (formationEnemies.length === 0) return;

    // 優先挑選蜂王
    const bosses = formationEnemies.filter(e => e.type === 'boss');
    if (bosses.length > 0 && Math.random() < 0.45) {
      const leader = bosses[Math.floor(Math.random() * bosses.length)];
      leader.startDive();
      soundCtrl.playDive();

      // 攜帶 1~2 隻突擊蜂當護衛
      const guards = formationEnemies.filter(e => e.type === 'guard');
      const escortCount = Math.min(guards.length, 2);
      for (let i = 0; i < escortCount; i++) {
        guards[i].startDive(leader.x + (i === 0 ? -40 : 40));
      }
    } else {
      // 隨機挑選 1~3 隻工蜂或突擊蜂
      const count = Math.min(formationEnemies.length, 1 + Math.floor(Math.random() * 2));
      for (let i = 0; i < count; i++) {
        const victim = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
        victim.startDive();
      }
      soundCtrl.playDive();
    }
  }

  // 遊戲結束處理
  gameOver() {
    this.state = STATE.GAMEOVER;
    soundCtrl.playGameOver();

    const elFinalScore = document.getElementById('finalScore');
    const elFinalWave = document.getElementById('finalWave');
    if (elFinalScore) elFinalScore.innerText = this.score;
    if (elFinalWave) elFinalWave.innerText = this.wave;

    document.getElementById('gameoverOverlay').classList.remove('hidden');
  }

  // 繪製渲染
  render() {
    this.ctx.save();

    // 螢幕震動偏移
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. 清除畫布並填充深邃太空白
    this.ctx.fillStyle = '#050711';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. 繪製星空背景
    this.stars.forEach(star => {
      this.ctx.fillStyle = star.color;
      this.ctx.globalAlpha = 0.5 + Math.sin(this.frameCount * 0.05 + star.twinkle) * 0.5;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    this.ctx.globalAlpha = 1;

    // 3. 繪製掉落道具
    this.powerups.forEach(pup => pup.draw(this.ctx, this.frameCount));

    // 4. 繪製敵機
    this.enemies.forEach(enemy => enemy.draw(this.ctx, this.frameCount));

    // 5. 繪製子彈
    this.playerBullets.forEach(b => Sprites.drawBullet(this.ctx, b.x, b.y, b.w, b.h, b.isSuper));
    this.enemyBullets.forEach(eb => Sprites.drawEnemyBullet(this.ctx, eb.x, eb.y, eb.radius, this.frameCount));

    // 6. 繪製玩家戰機
    if (this.player && this.player.isAlive) {
      this.player.draw(this.ctx, this.frameCount);
    }

    // 7. 繪製粒子效果
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1;

    // 8. 繪製飄浮文字
    this.floatingTexts.forEach(ft => {
      this.ctx.save();
      this.ctx.fillStyle = ft.color;
      this.ctx.globalAlpha = Math.max(0, ft.alpha);
      this.ctx.font = `bold ${ft.fontSize}px "Press Start 2P", monospace, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = ft.color;
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    });

    // 9. 全螢幕炸彈閃光效果
    if (this.screenFlash > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash / 15 * 0.6})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // 10. Combo 提示 HUD (畫面右上方)
    if (this.combo >= 2 && this.state === STATE.PLAYING) {
      const mult = Math.min(1 + Math.floor(this.combo / 4), 5);
      this.ctx.save();
      this.ctx.fillStyle = '#ff00ff';
      this.ctx.font = '12px "Press Start 2P", monospace, sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = '#ff00ff';
      this.ctx.fillText(`COMBO x${this.combo} (${mult}x PTS)`, this.width - 20, 60);

      // 連擊倒數條
      const barW = 80;
      const progress = this.comboTimer / 160;
      this.ctx.fillStyle = 'rgba(255, 0, 255, 0.4)';
      this.ctx.fillRect(this.width - 20 - barW, 66, barW, 4);
      this.ctx.fillStyle = '#00ffff';
      this.ctx.fillRect(this.width - 20 - barW, 66, barW * progress, 4);
      this.ctx.restore();
    }

    this.ctx.restore();
  }
}

// 玩家類別
class Player {
  constructor(game) {
    this.game = game;
    this.width = 44;
    this.height = 44;
    this.x = game.width / 2;
    this.y = game.height - 70;
    this.speed = 6.5;
    this.lives = 3;
    this.bombs = 1;
    this.isAlive = true;

    // 武器狀態
    this.shotLevel = 1; // 1: 單管, 2: 雙管, 3: 三管擴散射擊
    this.shotTimer = 0;
    this.fireCooldown = 0;
    this.fireRate = 12; // 射擊冷卻幀數 (自動連發節奏)

    // 防護罩與無敵時間
    this.shield = 0; // 護盾層數
    this.shieldRadius = 32;
    this.invulnerableTimer = 0;
  }

  get isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  update() {
    if (!this.isAlive) return;

    if (this.invulnerableTimer > 0) this.invulnerableTimer--;

    if (this.shotTimer > 0) {
      this.shotTimer--;
      if (this.shotTimer <= 0) {
        this.shotLevel = 1;
      }
    }

    // 左右移動控制
    if (this.game.keys.left) {
      this.x -= this.speed;
    }
    if (this.game.keys.right) {
      this.x += this.speed;
    }

    // 觸控/滑鼠跟隨控制
    if (this.game.touchControl.active && this.game.touchControl.targetX !== null) {
      const dx = this.game.touchControl.targetX - this.x;
      if (Math.abs(dx) > 3) {
        this.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.25, this.speed * 1.3);
      }
    }

    // 螢幕邊界限制
    const halfW = this.width / 2;
    if (this.x < halfW + 10) this.x = halfW + 10;
    if (this.x > this.game.width - halfW - 10) this.x = this.game.width - halfW - 10;

    // 射擊控制
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (this.game.keys.fire && this.fireCooldown <= 0) {
      this.shoot();
      this.fireCooldown = this.fireRate;
    }
  }

  shoot() {
    const isMulti = this.shotLevel > 1;
    soundCtrl.playLaser(isMulti);

    const bulletSpeed = -13;
    const bW = 5;
    const bH = 16;

    if (this.shotLevel === 1) {
      // 單管雷射
      this.game.playerBullets.push({
        x: this.x,
        y: this.y - 20,
        vx: 0,
        vy: bulletSpeed,
        w: bW,
        h: bH,
        damage: 1,
        isSuper: false
      });
    } else if (this.shotLevel === 2) {
      // 雙管雷射
      this.game.playerBullets.push(
        { x: this.x - 14, y: this.y - 15, vx: 0, vy: bulletSpeed, w: bW, h: bH, damage: 1, isSuper: false },
        { x: this.x + 14, y: this.y - 15, vx: 0, vy: bulletSpeed, w: bW, h: bH, damage: 1, isSuper: false }
      );
    } else {
      // 三管扇形擴散雷射
      this.game.playerBullets.push(
        { x: this.x, y: this.y - 20, vx: 0, vy: bulletSpeed, w: bW + 2, h: bH + 2, damage: 1.5, isSuper: true },
        { x: this.x - 16, y: this.y - 12, vx: -2.5, vy: bulletSpeed * 0.95, w: bW, h: bH, damage: 1, isSuper: false },
        { x: this.x + 16, y: this.y - 12, vx: 2.5, vy: bulletSpeed * 0.95, w: bW, h: bH, damage: 1, isSuper: false }
      );
    }
  }

  applyPowerup(type) {
    soundCtrl.playPowerup();
    switch (type) {
      case 'multi':
        this.shotLevel = Math.min(this.shotLevel + 1, 3);
        this.shotTimer = 600; // 10 秒
        this.game.addFloatingText(this.x, this.y - 30, 'TRIPLE LASER!', '#00f0ff');
        break;
      case 'shield':
        this.shield = 2; // 可吸收 2 次傷害
        this.game.addFloatingText(this.x, this.y - 30, 'SHIELD UP!', '#00ff66');
        break;
      case 'bomb':
        this.bombs = Math.min(this.bombs + 1, 3);
        this.game.addFloatingText(this.x, this.y - 30, '+1 EMP BOMB', '#ff9900');
        break;
      case 'speed':
        this.speed = 8.5;
        setTimeout(() => this.speed = 6.5, 8000);
        this.game.addFloatingText(this.x, this.y - 30, 'HYPER SPEED!', '#ffe600');
        break;
      case 'life':
        this.lives++;
        soundCtrl.play1Up();
        this.game.addFloatingText(this.x, this.y - 30, '1-UP EXTRA LIFE!', '#ff2a70');
        break;
    }
    this.game.updateHUD();
  }

  hitShield() {
    soundCtrl.playShieldHit();
    this.shield--;
    this.game.screenShake = 6;
    if (this.shield <= 0) {
      this.game.addFloatingText(this.x, this.y - 30, 'SHIELD BROKEN!', '#ff3366');
    }
  }

  die() {
    this.isAlive = false;
    soundCtrl.playExplosion('player');
    this.game.createExplosion(this.x, this.y, 45, null, 1.8);
    this.game.screenShake = 22;

    this.lives--;
    this.game.updateHUD();

    if (this.lives <= 0) {
      setTimeout(() => this.game.gameOver(), 1200);
    } else {
      // 1.2 秒後重生
      setTimeout(() => {
        this.x = this.game.width / 2;
        this.y = this.game.height - 70;
        this.isAlive = true;
        this.shotLevel = 1;
        this.invulnerableTimer = 150; // 2.5 秒無敵
      }, 1200);
    }
  }

  draw(ctx, frameCount) {
    Sprites.drawPlayer(ctx, this.x, this.y, this.width, this.height, this.isInvulnerable, frameCount);

    if (this.shield > 0) {
      Sprites.drawShield(ctx, this.x, this.y, this.shieldRadius, frameCount);
    }
  }
}

// 敵機類別 (編隊與貝茲俯衝演算法)
class Enemy {
  constructor(game, homeX, homeY, type, wave) {
    this.game = game;
    this.homeX = homeX;
    this.homeY = homeY;
    this.type = type; // 'drone', 'guard', 'boss'
    this.wave = wave;

    this.x = homeX;
    this.y = homeY;
    this.angle = 0;
    this.isAlive = true;

    // 屬性設定
    switch (type) {
      case 'boss':
        this.size = 40;
        this.maxHealth = 2 + Math.floor(wave / 2);
        this.pts = 200;
        break;
      case 'guard':
        this.size = 32;
        this.maxHealth = 1;
        this.pts = 100;
        break;
      case 'drone':
      default:
        this.size = 28;
        this.maxHealth = 1;
        this.pts = 50;
        break;
    }
    this.health = this.maxHealth;

    // 俯衝狀態機: 'formation', 'diving', 'returning'
    this.diveState = 'formation';
    this.diveT = 0;
    this.diveSpeed = 0.008 + (wave * 0.001);
    this.curvePoints = [];
    this.hasShotInDive = false;
  }

  update() {
    if (!this.isAlive) return;

    if (this.diveState === 'formation') {
      // 在編隊中跟隨整體左右擺動
      this.x = this.homeX + this.game.formationX;
      this.y = this.homeY;
      this.angle = 0;

      // 在編隊中偶爾投擲子彈 (機率隨波次提高)
      if (Math.random() < 0.0003 * this.wave) {
        this.shoot();
      }
    } else if (this.diveState === 'diving') {
      // 沿貝茲曲線 (Cubic Bezier Curve) 進行平滑俯衝
      this.diveT += this.diveSpeed;
      if (this.diveT >= 1) {
        // 完成俯衝，從螢幕頂部返回編隊
        this.diveState = 'returning';
        this.y = -40;
      } else {
        const p = this.getBezierPoint(this.diveT, this.curvePoints);
        const prevX = this.x;
        const prevY = this.y;
        this.x = p.x;
        this.y = p.y;
        this.angle = Math.atan2(this.y - prevY, this.x - prevX) + Math.PI / 2;

        // 在俯衝經過畫面中段時射擊
        if (!this.hasShotInDive && this.diveT > 0.4) {
          this.hasShotInDive = true;
          this.shoot(true);
        }
      }

      // 與玩家戰機衝撞檢測 (神風特攻隊)
      if (this.game.player && this.game.player.isAlive && !this.game.player.isInvulnerable) {
        const dist = Math.hypot(this.x - this.game.player.x, this.y - this.game.player.y);
        if (dist < (this.size * 0.5 + this.game.player.width * 0.4)) {
          if (this.game.player.shield > 0) {
            this.game.player.hitShield();
            this.die(true);
          } else {
            this.die(false);
            this.game.player.die();
          }
        }
      }
    } else if (this.diveState === 'returning') {
      // 平滑返回原編隊位置
      const targetX = this.homeX + this.game.formationX;
      const targetY = this.homeY;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        this.x = targetX;
        this.y = targetY;
        this.angle = 0;
        this.diveState = 'formation';
      } else {
        this.x += (dx / dist) * 4.5;
        this.y += (dy / dist) * 4.5;
        this.angle = Math.atan2(dy, dx) + Math.PI / 2;
      }
    }
  }

  // 發起俯衝 (生成三次貝茲控制點)
  startDive(targetX = null) {
    if (this.diveState !== 'formation') return;
    this.diveState = 'diving';
    this.diveT = 0;
    this.hasShotInDive = false;

    const start = { x: this.x, y: this.y };
    const playerX = targetX !== null ? targetX : (this.game.player ? this.game.player.x : this.game.width / 2);
    const loopSide = Math.random() < 0.5 ? -1 : 1;

    // 控制點 1: 向上盤旋起飛
    const p1 = { x: start.x + loopSide * 80, y: start.y - 50 };
    // 控制點 2: 瞄準玩家下衝
    const p2 = { x: playerX + (Math.random() - 0.5) * 100, y: this.game.height * 0.65 };
    // 終點: 穿出畫面底部
    const end = { x: playerX + loopSide * 150, y: this.game.height + 60 };

    this.curvePoints = [start, p1, p2, end];
  }

  // 貝茲曲線點計算
  getBezierPoint(t, pts) {
    const [p0, p1, p2, p3] = pts;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  shoot(aimAtPlayer = false) {
    if (!this.game.player) return;
    soundCtrl.playEnemyShoot();

    let vx = 0;
    let vy = 4.2;

    if (aimAtPlayer) {
      const dx = this.game.player.x - this.x;
      const dy = this.game.player.y - this.y;
      const dist = Math.hypot(dx, dy);
      const speed = 4.8 + this.wave * 0.2;
      vx = (dx / dist) * speed;
      vy = (dy / dist) * speed;
    }

    if (this.type === 'boss') {
      // 蜂王發射雙重電漿彈
      this.game.enemyBullets.push(
        { x: this.x - 10, y: this.y + 10, vx: vx - 0.6, vy: vy, radius: 4 },
        { x: this.x + 10, y: this.y + 10, vx: vx + 0.6, vy: vy, radius: 4 }
      );
    } else {
      this.game.enemyBullets.push({
        x: this.x,
        y: this.y + 8,
        vx: vx,
        vy: vy,
        radius: 3.5
      });
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.die(true);
    } else {
      soundCtrl.playExplosion('normal');
      this.game.createExplosion(this.x, this.y, 8, '#ff9900', 0.8);
    }
  }

  die(awardScore = true) {
    this.isAlive = false;
    soundCtrl.playExplosion(this.type === 'boss' ? 'boss' : 'normal');

    const particleCount = this.type === 'boss' ? 40 : 20;
    this.game.createExplosion(this.x, this.y, particleCount, null, this.type === 'boss' ? 1.5 : 1.0);
    this.game.screenShake = this.type === 'boss' ? 12 : 5;

    if (awardScore) {
      this.game.addScore(this.pts, this.x, this.y, this.diveState === 'diving');
    }

    // 隨機掉落道具 (蜂王必掉，其餘 12% 機率)
    if (this.type === 'boss' || Math.random() < 0.12) {
      this.game.dropPowerup(this.x, this.y);
    }

    // 從陣列中移除
    const idx = this.game.enemies.indexOf(this);
    if (idx !== -1) {
      this.game.enemies.splice(idx, 1);
    }
  }

  draw(ctx, frameCount) {
    if (this.type === 'boss') {
      Sprites.drawBoss(ctx, this.x, this.y, this.size, frameCount, this.health, this.maxHealth, this.angle);
    } else if (this.type === 'guard') {
      Sprites.drawGuard(ctx, this.x, this.y, this.size, frameCount, this.angle);
    } else {
      Sprites.drawDrone(ctx, this.x, this.y, this.size, frameCount, this.angle);
    }
  }
}

// 道具膠囊類別
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = 24;
    this.vy = 1.8;
  }

  update() {
    this.y += this.vy;
  }

  draw(ctx, frameCount) {
    Sprites.drawPowerup(ctx, this.x, this.y, this.size, this.type, frameCount);
  }
}

// 頁面載入完成後啟動遊戲
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});

