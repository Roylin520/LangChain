/**
 * 像素與向量精靈繪圖模組 (Canvas Sprite Rendering)
 * 使用原生 HTML5 Canvas 2D 繪製像素風格的太空戰機、敵機、子彈、特效
 */
const Sprites = {
  // 繪製玩家戰機
  drawPlayer(ctx, x, y, width, height, isInvulnerable, frameCount) {
    ctx.save();
    ctx.translate(x, y);

    // 無敵狀態閃爍效果
    if (isInvulnerable && Math.floor(frameCount / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const w2 = width / 2;
    const h2 = height / 2;

    // 1. 噴射引擎火焰動畫
    const flameLen = 8 + Math.sin(frameCount * 0.4) * 6;
    const grad = ctx.createLinearGradient(0, h2, 0, h2 + flameLen);
    grad.addColorStop(0, '#00ffff');
    grad.addColorStop(0.4, '#ffaa00');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-w2 * 0.4, h2 - 2);
    ctx.lineTo(0, h2 + flameLen);
    ctx.lineTo(w2 * 0.4, h2 - 2);
    ctx.closePath();
    ctx.fill();

    // 2. 戰機機翼底色 (金屬灰白)
    ctx.fillStyle = '#e0e6ed';
    ctx.beginPath();
    ctx.moveTo(0, -h2); // 機頭
    ctx.lineTo(w2, h2 * 0.7); // 右翼尖
    ctx.lineTo(w2 * 0.6, h2); // 右翼根部
    ctx.lineTo(w2 * 0.2, h2 * 0.6);
    ctx.lineTo(-w2 * 0.2, h2 * 0.6);
    ctx.lineTo(-w2 * 0.6, h2); // 左翼根部
    ctx.lineTo(-w2, h2 * 0.7); // 左翼尖
    ctx.closePath();
    ctx.fill();

    // 3. 戰機飾條與塗裝 (經典小蜜蜂紅白藍條紋)
    ctx.fillStyle = '#ff2a5f';
    ctx.beginPath();
    ctx.moveTo(0, -h2 + 4);
    ctx.lineTo(w2 * 0.5, h2 * 0.5);
    ctx.lineTo(w2 * 0.3, h2 * 0.6);
    ctx.lineTo(0, -h2 * 0.2);
    ctx.lineTo(-w2 * 0.3, h2 * 0.6);
    ctx.lineTo(-w2 * 0.5, h2 * 0.5);
    ctx.closePath();
    ctx.fill();

    // 4. 兩側雷射砲管
    ctx.fillStyle = '#00d2ff';
    ctx.fillRect(-w2 + 2, -h2 * 0.1, 4, h2 * 0.7);
    ctx.fillRect(w2 - 6, -h2 * 0.1, 4, h2 * 0.7);

    // 砲管前端發光發熱點
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w2 + 2, -h2 * 0.1, 4, 3);
    ctx.fillRect(w2 - 6, -h2 * 0.1, 4, 3);

    // 5. 駕駛艙 (發光青色玻璃)
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.ellipse(0, -h2 * 0.1, w2 * 0.22, h2 * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-1, -h2 * 0.2, w2 * 0.08, h2 * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // 繪製工蜂 (Drone - 經典黃/綠小蜜蜂)
  drawDrone(ctx, x, y, size, frameCount, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);

    const s = size / 2;
    const flap = Math.sin(frameCount * 0.3) * (s * 0.3); // 振翅動畫

    // 1. 翅膀 (青白色透明感)
    ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
    // 左翼
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.2);
    ctx.lineTo(-s * 1.3, -s * 0.7 - flap);
    ctx.lineTo(-s * 0.9, s * 0.4);
    ctx.closePath();
    ctx.fill();
    // 右翼
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.2);
    ctx.lineTo(s * 1.3, -s * 0.7 - flap);
    ctx.lineTo(s * 0.9, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // 2. 腹部身體 (黃黑相間條紋)
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.2, s * 0.6, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111122';
    ctx.fillRect(-s * 0.5, -s * 0.1, s * 1.0, s * 0.25);
    ctx.fillRect(-s * 0.45, s * 0.3, s * 0.9, s * 0.25);

    // 3. 頭部與大眼睛
    ctx.fillStyle = '#22cc88';
    ctx.beginPath();
    ctx.arc(0, -s * 0.45, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 紅色複眼
    ctx.fillStyle = '#ff1144';
    ctx.beginPath();
    ctx.arc(-s * 0.22, -s * 0.5, s * 0.16, 0, Math.PI * 2);
    ctx.arc(s * 0.22, -s * 0.5, s * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // 4. 尾針
    ctx.fillStyle = '#ff2255';
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.85);
    ctx.lineTo(0, s * 1.25);
    ctx.lineTo(s * 0.15, s * 0.85);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  // 繪製突擊蜂 (Guard - 經典紅/橙色甲蟲蜂)
  drawGuard(ctx, x, y, size, frameCount, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);

    const s = size / 2;
    const flap = Math.cos(frameCount * 0.35) * (s * 0.35);

    // 1. 外側雙翼
    ctx.fillStyle = 'rgba(255, 100, 50, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, 0);
    ctx.lineTo(-s * 1.4, -s * 0.5 + flap);
    ctx.lineTo(-s * 0.7, s * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s * 0.2, 0);
    ctx.lineTo(s * 1.4, -s * 0.5 + flap);
    ctx.lineTo(s * 0.7, s * 0.7);
    ctx.closePath();
    ctx.fill();

    // 2. 主甲殼 (鮮紅色硬甲)
    ctx.fillStyle = '#ff2a2a';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 0.7, s * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // 背部黃色菱形核心
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.lineTo(s * 0.35, s * 0.1);
    ctx.lineTo(0, s * 0.5);
    ctx.lineTo(-s * 0.35, s * 0.1);
    ctx.closePath();
    ctx.fill();

    // 3. 雙角/螯肢
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.4);
    ctx.lineTo(-s * 0.55, -s * 0.95);
    ctx.lineTo(-s * 0.25, -s * 1.1);
    ctx.moveTo(s * 0.25, -s * 0.4);
    ctx.lineTo(s * 0.55, -s * 0.95);
    ctx.lineTo(s * 0.25, -s * 1.1);
    ctx.stroke();

    // 4. 青藍色發光眼
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.35, s * 0.15, 0, Math.PI * 2);
    ctx.arc(s * 0.25, -s * 0.35, s * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // 繪製蜂王 (Boss Queen - 巨型母艦蜂，含受傷血量變色)
  drawBoss(ctx, x, y, size, frameCount, health, maxHealth, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);

    const s = size / 2;
    const isHurt = health < maxHealth;
    const flap = Math.sin(frameCount * 0.25) * (s * 0.25);

    // 1. 巨大主翅膀
    ctx.fillStyle = isHurt ? 'rgba(255, 60, 100, 0.75)' : 'rgba(50, 180, 255, 0.75)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.1);
    ctx.lineTo(-s * 1.45, -s * 0.8 + flap);
    ctx.lineTo(-s * 1.2, s * 0.5);
    ctx.lineTo(-s * 0.4, s * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.1);
    ctx.lineTo(s * 1.45, -s * 0.8 + flap);
    ctx.lineTo(s * 1.2, s * 0.5);
    ctx.lineTo(s * 0.4, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // 2. 蜂王主軀幹 (受傷轉為狂暴紅)
    ctx.fillStyle = isHurt ? '#2b003b' : '#0a3d62';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.15, s * 0.75, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. 王冠飾甲 (金黃色皇冠)
    ctx.fillStyle = isHurt ? '#ff3366' : '#ffd700';
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.4);
    ctx.lineTo(-s * 0.4, -s * 1.05);
    ctx.lineTo(-s * 0.15, -s * 0.6);
    ctx.lineTo(0, -s * 1.2);
    ctx.lineTo(s * 0.15, -s * 0.6);
    ctx.lineTo(s * 0.4, -s * 1.05);
    ctx.lineTo(s * 0.6, -s * 0.4);
    ctx.closePath();
    ctx.fill();

    // 4. 能量核心 (脈動光球)
    const pulse = 0.8 + Math.sin(frameCount * 0.2) * 0.2;
    ctx.fillStyle = isHurt ? `rgba(255, 20, 50, ${pulse})` : `rgba(0, 255, 200, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, s * 0.2, s * 0.35 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 5. 邪惡發光雙眼
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.2, s * 0.15, 0, Math.PI * 2);
    ctx.arc(s * 0.25, -s * 0.2, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.2, s * 0.08, 0, Math.PI * 2);
    ctx.arc(s * 0.25, -s * 0.2, s * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // 6. 血量條 (受傷時在頭頂顯示)
    if (health < maxHealth) {
      const barW = s * 1.5;
      const barH = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-barW / 2, -s * 1.4, barW, barH);
      ctx.fillStyle = '#ff2255';
      ctx.fillRect(-barW / 2, -s * 1.4, barW * (health / maxHealth), barH);
    }

    ctx.restore();
  },

  // 繪製玩家雷射子彈
  drawBullet(ctx, x, y, width, height, isSuper = false) {
    ctx.save();
    // 外層光暈
    ctx.shadowBlur = 8;
    ctx.shadowColor = isSuper ? '#ff00ff' : '#00e5ff';

    // 雷射光束本體
    const grad = ctx.createLinearGradient(0, y, 0, y + height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, isSuper ? '#ff40aa' : '#00ffff');
    grad.addColorStop(1, isSuper ? '#8800ff' : '#0066ff');

    ctx.fillStyle = grad;
    ctx.fillRect(x - width / 2, y, width, height);

    // 核心亮線
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y + 2, 2, height - 4);

    ctx.restore();
  },

  // 繪製敵方能量彈
  drawEnemyBullet(ctx, x, y, radius, frameCount) {
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ff2a5f';

    // 旋轉發光電漿球
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#ff3366');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // 中心亮點
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // 繪製強化道具膠囊
  drawPowerup(ctx, x, y, size, type, frameCount) {
    ctx.save();
    ctx.translate(x, y);

    const bob = Math.sin(frameCount * 0.1) * 3;
    ctx.translate(0, bob);

    const s = size / 2;
    let color = '#00ffff';
    let label = 'S';

    switch (type) {
      case 'multi':
        color = '#00f0ff';
        label = '3X';
        break;
      case 'shield':
        color = '#00ff66';
        label = '🛡️';
        break;
      case 'bomb':
        color = '#ff9900';
        label = '💣';
        break;
      case 'life':
        color = '#ff2a70';
        label = '❤️';
        break;
      case 'speed':
        color = '#ffe600';
        label = '⚡';
        break;
    }

    // 發光光暈
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;

    // 膠囊底色圓形/徽章
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 膠囊內部旋轉環
    ctx.strokeStyle = `rgba(${type === 'life' ? '255,50,100' : '0,255,255'}, 0.4)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.75, frameCount * 0.05, frameCount * 0.05 + Math.PI * 1.5);
    ctx.stroke();

    // 標籤文字/符號
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${s * 0.95}px "Press Start 2P", monospace, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);

    ctx.restore();
  },

  // 繪製玩家能量護盾
  drawShield(ctx, x, y, radius, frameCount) {
    ctx.save();
    ctx.translate(x, y);

    const pulse = 1 + Math.sin(frameCount * 0.15) * 0.05;
    const r = radius * pulse;

    // 護盾外圈霓虹光
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffcc';

    ctx.strokeStyle = 'rgba(0, 255, 204, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // 護盾內部半透明六角形蜂巢網格
    ctx.fillStyle = 'rgba(0, 255, 204, 0.12)';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 + frameCount * 0.02;
      const hx = Math.cos(ang) * (r - 2);
      const hy = Math.sin(ang) * (r - 2);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
};

