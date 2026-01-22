/**
 * 将 Lab 颜色空间转换为近似 sRGB 颜色，用于前端颜色小圆展示
 * 简化版 CIE Lab -> XYZ -> sRGB 转换
 */
export const labToRgbColor = (L: number, a: number, b: number): string => {
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const pivot = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };

  const X = 95.047 * pivot(x);
  const Y = 100.0 * pivot(y);
  const Z = 108.883 * pivot(z);

  let r = X * 0.032406 + Y * -0.015372 + Z * -0.004986;
  let g = X * -0.009689 + Y * 0.018758 + Z * 0.000415;
  let bl = X * 0.000557 + Y * -0.00204 + Z * 0.01057;

  const convert = (c: number) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  r = convert(r);
  g = convert(g);
  bl = convert(bl);

  const to255 = (c: number) => Math.round(c * 255);

  return `rgb(${to255(r)}, ${to255(g)}, ${to255(bl)})`;
};
