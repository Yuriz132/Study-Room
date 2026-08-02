import { useEffect, useRef, type CSSProperties, type ReactNode, type HTMLAttributes } from 'react';

// 纯液态玻璃（Liquid Glass）— 透明 + 真实折射，无磨砂模糊
// 移植自 Shu Ding 的 liquid-glass（https://github.com/shuding/liquid-glass）。
// 关键：用 canvas 依据「内缩后的圆角矩形 SDF」生成位移贴图(R=dx, G=dy)，
// 喂给 SVG <feDisplacementMap>，让 backdrop-filter 对背后内容做真实折射。
// 折射集中在圆角/边缘处，呈透镜感。
// 目标环境：Chrome / Android / 微信(X5)，无需兼容 iOS(Safari 不支持 backdrop-filter:url())。

function smoothStep(a: number, b: number, t: number) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function length(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

// 有符号距离场：点 (x,y) 到圆角矩形的距离（内部为负，外部为正），单位与传入一致(px)
function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number) {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

type LiquidGlassProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 圆角半径(px)；不传则读取元素实际 border-radius，使折射透镜与圆角对齐 */
  radius?: number;
  /** 背景模糊(px)；默认 0 = 不要磨砂，仅折射 */
  blur?: number;
  /** 渲染标签，默认 div；番茄钟触发按钮用 button */
  as?: 'div' | 'button' | 'header' | 'section' | 'nav';
};

export function LiquidGlass({
  children,
  className = '',
  style,
  radius,
  blur = 0,
  as = 'div',
  ...rest
}: LiquidGlassProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const id = 'lg-' + Math.random().toString(36).slice(2, 9);
    const svgns = 'http://www.w3.org/2000/svg';
    const xlink = 'http://www.w3.org/1999/xlink';

    // 1) 注入 SVG 滤镜（位移贴图）
    const svg = document.createElementNS(svgns, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:9998;';

    const defs = document.createElementNS(svgns, 'defs');
    const filter = document.createElementNS(svgns, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('colorInterpolationFilters', 'sRGB');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');

    const feImage = document.createElementNS(svgns, 'feImage');
    feImage.setAttribute('id', id + '_map');
    feImage.setAttribute('width', '10');
    feImage.setAttribute('height', '10');

    const feDisp = document.createElementNS(svgns, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', id + '_map');
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(feImage);
    filter.appendChild(feDisp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    // 2) 隐藏 canvas：画位移贴图（R=dx, G=dy）
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const applyBackdrop = () => {
      const f = `url(#${id})${blur > 0 ? ` blur(${blur}px)` : ''} contrast(1.2) brightness(1.05) saturate(1.1)`;
      (el.style as any).backdropFilter = f;
      (el.style as any).webkitBackdropFilter = f;
    };

    // 3) 依据元素尺寸生成位移贴图
    const update = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h || !ctx) return;
      canvas.width = w;
      canvas.height = h;
      feImage.setAttribute('width', String(w));
      feImage.setAttribute('height', String(h));
      filter.setAttribute('width', String(w));
      filter.setAttribute('height', String(h));

      // 关键参数调优（第 8 轮修正）：
      // 1) margin 从 0.25 缩减到 0.12：SDF 形状仅微缩于元素，
      //    使元素边缘（文字刚进入处）就落入折射带，而非要进入 2/3 才有折射。
      // 2) 形状用「全圆角 stadium」(半径=min 半宽高)，边缘透镜感强。
      // 3) smoothStep 阈值收紧：dn > 0.04 即开始折射（之前 0.1），带更宽。
      // 4) yBoost 垂直增强保留（顶栏很扁）。
      const margin = Math.min(w, h) * 0.12;
      const halfW = w / 2 - margin;
      const halfH = h / 2 - margin;
      const stadium = Math.min(halfW, halfH);
      const rShape = radius != null ? Math.min(stadium, radius) : stadium;
      const yBoost = 2.2; // 垂直(上下)折射增强系数

      const data = new Uint8ClampedArray(w * h * 4);
      let maxScale = 0;
      const raw: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x - w / 2;
          const py = y - h / 2;
          // SDF 距离（px），再归一化到 min(w,h) 以保持与 smoothStep 阈值尺度一致
          const d = roundedRectSDF(px, py, halfW, halfH, rShape);
          const dn = d / Math.min(w, h);
          const displacement = smoothStep(0.72, 0, dn - 0.04);
          const scaled = smoothStep(0, 1, displacement);
          const dx = px * (scaled - 1);
          const dy = py * (scaled - 1) * yBoost;
          maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
          raw.push(dx, dy);
        }
      }
      maxScale *= 0.5;
      if (maxScale === 0) maxScale = 1;

      let idx = 0;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((raw[idx++] / maxScale) + 0.5) * 255;
        data[i + 1] = ((raw[idx++] / maxScale) + 0.5) * 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      ctx.putImageData(new ImageData(data, w, h), 0, 0);
      const url = canvas.toDataURL();
      feImage.setAttribute('href', url);
      feImage.setAttributeNS(xlink, 'href', url);
      feDisp.setAttribute('scale', String(maxScale));
      applyBackdrop();
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      svg.remove();
      canvas.remove();
    };
  }, [radius, blur]);

  const Tag = as as any;
  return (
    <Tag ref={ref as any} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}
