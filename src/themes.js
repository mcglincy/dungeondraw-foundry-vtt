import * as constants from "./constants.js";

export const defaultConfig = () => {
  return {
    doorColor: "#000000",
    doorFillColor: "#ffffff",
    doorFillOpacity: 1.0,
    doorLineThickness: 8,
    doorThickness: 25,
    exteriorShadowColor: "#000000",
    exteriorShadowThickness: 20,
    exteriorShadowOpacity: 0.5,
    floorColor: "#F2EDDF",
    floorOpacity: 1.0,
    floorTexture: "",
    floorTextureRotation: 0,
    floorTextureScaling: 1,
    floorTextureTint: "",
    interiorShadowColor: "#000000",
    interiorShadowThickness: 8,
    interiorShadowOpacity: 0.5,
    invisibleWallColor: "#000000",
    invisibleWallFillColor: "#ffffff",
    invisibleWallLineThickness: 2,
    invisibleWallFillOpacity: 1.0,
    invisibleWallThickness: 6,
    matchBaseWalls: true,
    sceneBackgroundColor: "#999999",
    sceneGridColor: "#000000",
    sceneGridOpacity: 0.2,
    secretDoorSColor: "#ffffff",
    secretDoorStyleGM: "secret",
    secretDoorStylePlayer: "wall",
    threeDDoorTexture:
      "modules/dungeon-draw/assets/textures/3d_arena-gate-texture.webp",
    threeDDoorTextureTint: "",
    threeDWallTexture: "",
    threeDWallTextureTint: "",
    threeDWallSidesTexture: "",
    threeDWallSidesTextureTint: "",
    wallColor: "#000000",
    wallTexture: "",
    WallTextureScaling: 1,
    wallTextureTint: "",
    wallThickness: 8,
  };
};

export const getTheme = (themeKey) => {
  const splits = themeKey.split(".");
  const type = splits[0];
  const key = splits[1];
  if (type === "custom") {
    const customThemes = getCustomThemes();
    return customThemes[key];
  }
  return themes[key];
};

export const getCustomThemes = () => {
  try {
    const customThemesString = game.settings.get(
      constants.MODULE_NAME,
      "customThemes"
    );
    const themeObj = JSON.parse(customThemesString);
    // ensure saved custom themes get any new defaults
    Object.keys(themeObj).forEach((key) => {
      themeObj[key].config = foundry.utils.mergeObject(
        defaultConfig(),
        themeObj[key].config
      );
    });
    return themeObj;
  } catch (e) {
    console.log(e);
    return {};
  }
};

export const setCustomThemes = (customThemes) => {
  const themesString = JSON.stringify(customThemes);
  game.settings.set(constants.MODULE_NAME, "customThemes", themesString);
};

export const getThemePainterThemeKey = () => {
  return game.settings.get(
    constants.MODULE_NAME,
    constants.SETTING_THEME_PAINTER_THEME
  );
};

export const setThemePainterThemeKey = (themeKey) => {
  return game.settings.set(
    constants.MODULE_NAME,
    constants.SETTING_THEME_PAINTER_THEME,
    themeKey
  );
};

export const themes = {
  default: {
    name: "Default",
    config: defaultConfig(),
  },
  arcPavement: {
    name: "Arc Pavement",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#111111",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Arc_Pavement_001_basecolor.jpg",
      invisibleWallThickness: 10,
      wallColor: "#111111",
      wallThickness: 12,
    }),
  },
  basicBlack: {
    name: "Basic Black",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#0D0D0D",
      doorFillOpacity: 0.0,
      exteriorShadowOpacity: 0,
      interiorShadowOpacity: 0,
      invisibleWallColor: "#0D0D0D",
      floorColor: "#FFFFFF",
      sceneBackgroundColor: "#0D0D0D",
      sceneGridOpacity: 1.0,
      secretDoorSColor: "#0D0D0D",
      wallColor: "#0D0D0D",
    }),
  },
  cavern: {
    name: "Cavern",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#2B2D2F",
      invisibleWallThickness: 10,
      floorTexture:
        "modules/dungeon-draw/assets/textures/Stylized_Stone_Floor_002_bw.jpg",
      wallColor: "#2B2D2F",
      wallThickness: 12,
    }),
  },
  checkerboard: {
    name: "Checkerboard",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorFillColor: "#C2BFB0",
      floorTexture:
        "modules/dungeon-draw/assets/textures/sci_fi_texture_150_by_llexandro_d939vk9.png",
      invisibleWallFillColor: "#C2BFB0",
      invisibleWallThickness: 8,
      secretDoorSColor: "#C2BFB0",
      wallThickness: 10,
    }),
  },
  cobblestone: {
    name: "Cobblestone",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#222222",
      doorFillColor: "#FFFFFF",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Cobblestone_001_COLOR.jpg",
      invisibleWallColor: "#222222",
      invisibleWallFillColor: "#FFFFFF",
      invisibleWallThickness: 10,
      secretDoorSColor: "#FFFFFF",
      wallColor: "#222222",
      wallThickness: 12,
    }),
  },
  dirt: {
    name: "Dirt",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#1a1714",
      doorFillColor: "#8d7862",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Ground_Dirt_007_basecolor.jpg",
      invisibleWallColor: "#1a1714",
      invisibleWallFillColor: "#8d7862",
      invisibleWallThickness: 8,
      secretDoorSColor: "#8d7862",
      wallColor: "#1a1714",
      wallThickness: 10,
    }),
  },
  dungeonSquares: {
    name: "Dungeon Squares",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#111111",
      floorTexture:
        "modules/dungeon-draw/assets/textures/outdoor+stone+tiles+pavement.jpg",
      invisibleWallColor: "#111111",
      invisibleWallThickness: 10,
      wallColor: "#111111",
      wallThickness: 12,
    }),
  },
  grass: {
    name: "Grass",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#72471d",
      doorFillColor: "#eee8c1",
      floorTexture: "modules/dungeon-draw/assets/textures/Grass_001_COLOR.jpg",
      invisibleWallColor: "#72471d",
      invisibleWallFillColor: "#eee8c1",
      invisibleWallThickness: 10,
      secretDoorSColor: "#eee8c1",
      wallColor: "#72471d",
      wallThickness: 10,
    }),
  },
  groovyCarpet: {
    name: "Groovy Carpet",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#2B2D2F",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Fabric_Rug_006_basecolor.jpg",
      invisibleWallColor: "#2B2D2F",
      invisibleWallThickness: 10,
      wallColor: "#2B2D2F",
      wallThickness: 12,
    }),
  },
  hexagon: {
    name: "Hexagons",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#282828",
      doorFillColor: "#D1BD8A",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Rocks_Hexagons_002_basecolor.jpg",
      invisibleWallColor: "#282828",
      invisibleWallFillColor: "#D1BD8A",
      invisibleWallThickness: 10,
      secretDoorSColor: "#D1BD8A",
      wallColor: "#282828",
      wallThickness: 12,
    }),
  },
  marble: {
    name: "Marble",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#686882",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Marble_Tiles_001_basecolor.jpg",
      invisibleWallColor: "#686882",
      wallColor: "#686882",
    }),
  },
  metalGrid: {
    name: "Metal Grid",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#27251A",
      doorFillColor: "#AAAAAA",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Sci-fi_Floor_002_basecolor.jpg",
      invisibleWallColor: "#27251A",
      invisibleWallFillColor: "#AAAAAA",
      secretDoorSColor: "#AAAAAA",
      wallColor: "#27251A",
    }),
  },
  metalSquares: {
    name: "Metal Squares",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorFillColor: "#C0C0C0",
      floorTexture:
        "modules/dungeon-draw/assets/textures/sci_fi_texture_212_by_llexandro_dcuxgum.png",
      invisibleWallFillColor: "#C0C0C0",
      secretDoorSColor: "#C0C0C0",
    }),
  },
  moldvayBlue: {
    name: "Moldvay Blue",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#3A9FF2",
      doorFillOpacity: 0.0,
      doorThickness: 35,
      exteriorShadowOpacity: 0,
      floorColor: "#FFFFFF",
      interiorShadowOpacity: 0,
      invisibleWallColor: "#3A9FF2",
      invisibleWallFillOpacity: 0.0,
      sceneBackgroundColor: "#3A9FF2",
      sceneGridColor: "#3A9FF2",
      sceneGridOpacity: 1.0,
      secretDoorSColor: "#3A9FF2",
      wallColor: "#3A9FF2",
    }),
  },
  neonBlueprint: {
    name: "Neon Blueprint",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#3A9FF2",
      doorFillOpacity: 0.0,
      doorThickness: 35,
      exteriorShadowColor: "#18495E",
      floorColor: "#142A3B",
      interiorShadowColor: "#1B7FAB",
      invisibleWallColor: "#3A9FF2",
      invisibleWallFillOpacity: 0.0,
      invisibleWallLineThickness: 1,
      invisibleWallThickness: 6,
      sceneBackgroundColor: "#171008",
      sceneGridColor: "#4C89A1",
      sceneGridOpacity: 1.0,
      secretDoorSColor: "#3A9FF2",
      wallColor: "#63C9E6",
      wallThickness: 4,
    }),
  },
  ruddyPaper: {
    name: "Ruddy Paper",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#913B55",
      doorFillColor: "#FADEE6",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Paper_Recycled_001_COLOR.jpg",
      floorTextureTint: "#F9FAE6",
      exteriorShadowOpacity: 0,
      interiorShadowOpacity: 0,
      invisibleWallColor: "#913B55",
      invisibleWallFillColor: "#FADEE6",
      sceneBackgroundColor: "#EBD3BC",
      sceneGridColor: "#594026",
      sceneGridOpacity: 1.0,
      secretDoorSColor: "#913B55",
      wallColor: "#9A6D54",
    }),
  },
  water: {
    name: "Water",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#203246",
      floorTexture: "modules/dungeon-draw/assets/textures/Water_001_COLOR.jpg",
      invisibleWallColor: "#203246",
      invisibleWallLineThickness: 1,
      invisibleWallThickness: 4,
      wallColor: "#203246",
      wallThickness: 5,
    }),
  },
  woodPlanks: {
    name: "Wood Planks",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#332211",
      floorTexture:
        "modules/dungeon-draw/assets/textures/Old_Wooden_Plank_Seamless_Texture_765.jpg",
      invisibleWallColor: "#332211",
      invisibleWallThickness: 13,
      wallColor: "#332211",
      wallTexture: "modules/dungeon-draw/assets/textures/Bark_002_bw.jpg",
      wallTextureTint: "#7e5935",
      wallThickness: 15,
    }),
  },
  xenomorph: {
    name: "Xenomorph",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#8AF0F0",
      doorFillColor: "#255151",
      doorLineThickness: 5,
      doorThickness: 20,
      exteriorShadowColor: "#00838C",
      floorColor: "#255151",
      interiorShadowColor: "#00838C",
      invisibleWallColor: "#8AF0F0",
      invisibleWallFillColor: "#255151",
      invisibleWallLineThickness: 1,
      invisibleWallThickness: 6,
      sceneBackgroundColor: "#002222",
      sceneGridColor: "#ffffff",
      sceneGridOpacity: 1,
      secretDoorSColor: "#8AF0F0",
      wallColor: "#8AF0F0",
      wallThickness: 4,
    }),
  },
};
