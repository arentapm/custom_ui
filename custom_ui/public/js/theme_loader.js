function applyTheme(vars) {
  const baseColor = vars['--primary-color'] || '#29CD42';
  const primaryLight = lighten(baseColor, 50);
  const primaryDark = darken(baseColor, 25);
  const primaryTextOnLight = getTextColor(primaryLight);
  const primaryTextOnDark = getTextColor(baseColor);

  const root = document.documentElement.style;

  root.setProperty('--primary-color', baseColor);
  root.setProperty('--primary-light', primaryLight);
  root.setProperty('--primary-dark', primaryDark);
  root.setProperty('--text-color-light', '#ffffff');
  root.setProperty('--text-color-dark', '#154215');
  root.setProperty('--bg-color', primaryLight);
  root.setProperty('--text-color', primaryTextOnLight);
  root.setProperty('--header-bg', baseColor);
  root.setProperty('--header-text', primaryTextOnDark);
  root.setProperty('--btn-bg-color', baseColor);
  root.setProperty('--btn-text-color', primaryTextOnDark);
  root.setProperty('--btn-hover-bg', primaryDark);
  root.setProperty('--link-color', darken(baseColor, 10));

  console.log("✅ Tema diterapkan dengan base:", baseColor);
}

function lighten(color, percent) {
  const num = parseInt(color.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
  return "#" + (
    0x1000000 + 
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + 
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + 
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

function darken(color, percent) {
  const num = parseInt(color.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) - amt,
        G = (num >> 8 & 0x00FF) - amt,
        B = (num & 0x0000FF) - amt;
  return "#" + (
    0x1000000 + 
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + 
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + 
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

function getTextColor(bgColor) {
  const color = bgColor.substring(1); // remove #
  const r = parseInt(color.substr(0,2),16);
  const g = parseInt(color.substr(2,2),16);
  const b = parseInt(color.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? "#000000" : "#FFFFFF";
}

document.addEventListener("DOMContentLoaded", function () {
  const vars = {
    "--primary-color": "#29CD42"
  };
  applyTheme(vars);
});
