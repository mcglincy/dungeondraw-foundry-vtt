import { Dungeon } from "./dungeon.js";
import { DungeonDraw } from "./dungeondraw.js";

export const defaultConfig = () => {
  return {
    backgroundImage: "",
    doorThickness: 25,
    doorColor: "#000000",
    doorFillColor: "#ffffff",
    doorFillOpacity: 0.0,
    exteriorShadowColor: "#000000",
    exteriorShadowThickness: 20,
    exteriorShadowOpacity: 0.5,
    floorColor: "#F2EDDF",
    floorTexture: "",
    floorTextureTint: "",
    interiorShadowColor: "#000000",
    interiorShadowThickness: 8,
    interiorShadowOpacity: 0.5,
    sceneBackgroundColor: "#999999",
    sceneGridColor: "#000000",
    sceneGridOpacity: 0.2,
    wallColor: "#000000",
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
    const customThemesString = game.settings.get(DungeonDraw.MODULE_NAME, "customThemes");
    return JSON.parse(customThemesString);
  } catch(e) {
    console.log(e);
    return {};
  }
};

export const setCustomThemes = (customThemes) => {
  const themesString = JSON.stringify(customThemes);
  game.settings.set(DungeonDraw.MODULE_NAME, "customThemes", themesString);
};

export const getThemePainterThemeKey = () => {
  return game.settings.get(DungeonDraw.MODULE_NAME, DungeonDraw.SETTING_THEME_PAINTER_THEME);
}

export const setThemePainterThemeKey = (themeKey) => {
  return game.settings.set(DungeonDraw.MODULE_NAME, DungeonDraw.SETTING_THEME_PAINTER_THEME, themeKey);
}

export const themes = {
  default: {
    name: "Default",
    config: defaultConfig(),
  },
  arcPavement: {
    name: "Arc Pavement",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#111111",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Arc_Pavement_001_basecolor.jpg",
      wallColor: "#111111",
      wallThickness: 12,
    })
  },    
  basicBlack: {
    name: "Basic Black",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#0D0D0D",
      exteriorShadowOpacity: 0,
      interiorShadowOpacity: 0,
      floorColor: "#FFFFFF",
      sceneBackgroundColor: "#0D0D0D",
      sceneGridOpacity: 1.0,
      wallColor: "#0D0D0D",
    })
  },
  cavern: {
    name: "Cavern",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#2B2D2F",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Stylized_Stone_Floor_002_bw.jpg",
      wallColor: "#2B2D2F",
      wallThickness: 12,
    })
  },    
  checkerboard: {
    name: "Checkerboard",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorFillColor: "#C2BFB0",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/sci_fi_texture_150_by_llexandro_d939vk9.png",
      wallThickness: 10,
    })
  },
  cobblestone: {
    name: "Cobblestone",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#222222",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Cobblestone_001_Color.jpg",
      wallColor: "#222222",
      wallThickness: 12,        
    })
  },
  dirt: {
    name: "Dirt",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#1a1714",
      doorFillColor: "#8d7862",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Ground_Dirt_007_basecolor.jpg",
      wallColor: "#1a1714",
      wallThickness: 10,
    })
  },  
  dungeonSquares: {
    name: "Dungeon Squares",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#111111",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/outdoor+stone+tiles+pavement.jpg",
      wallColor: "#111111",
      wallThickness: 12,        
    })
  },
  grass: {
    name: "Grass",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#72471d",
      doorFillColor: "#eee8c1",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Grass_001_COLOR.jpg",
      wallColor: "#72471d",
      wallThickness: 10,      
    })
  },
  groovyCarpet: {
    name: "Groovy Carpet",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#2B2D2F",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Fabric_Rug_006_basecolor.jpg",
      wallColor: "#2B2D2F",
      wallThickness: 12,        
    })
  },
  hexagon: {
    name: "Hexagons",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#282828",
      doorFillColor: "#D1BD8A",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Rocks_Hexagons_002_basecolor.jpg",
      wallColor: "#282828",
      wallThickness: 12,      
    })
  },  
  marble: {
    name: "Marble",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#686882",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Marble_Tiles_001_basecolor.jpg",
      wallColor: "#686882",
    })
  },
  metalGrid: {
    name: "Metal Grid",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#27251A",
      doorFillColor: "#AAAAAA",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Sci-fi_Floor_002_basecolor.jpg",
      wallColor: "#27251A",
    })
  },  
  metalSquares: {
    name: "Metal Squares",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorFillColor: "#C0C0C0",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/sci_fi_texture_212_by_llexandro_dcuxgum.png",
    })
  },
  moldvayBlue: {
    name: "Moldvay Blue",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#3A9FF2",
      doorThickness: 35,
      exteriorShadowOpacity: 0,
      floorColor: "#FFFFFF",
      interiorShadowOpacity: 0,
      sceneBackgroundColor: "#3A9FF2",
      sceneGridColor: "#3A9FF2",
      sceneGridOpacity: 1.0,
      wallColor: "#3A9FF2",
    })
  },
  neonBlueprint: {
    name: "Neon Blueprint",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#3A9FF2",
      doorThickness: 35,
      exteriorShadowColor: "#18495E",
      floorColor: "#142A3B",
      interiorShadowColor: "#1B7FAB",
      sceneBackgroundColor: "#171008",
      sceneGridColor: "#4C89A1",
      sceneGridOpacity: 1.0,
      wallColor: "#63C9E6",
      wallThickness: 4,
    })
  },
  ruddyPaper: {
    name: "Ruddy Paper",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#913B55",
      doorFillColor: "#FADEE6",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Paper_Recycled_001_COLOR.jpg",
      floorTextureTint: "#F9FAE6",
      exteriorShadowOpacity: 0,
      interiorShadowOpacity: 0,      
      sceneBackgroundColor: "#EBD3BC",
      sceneGridColor: "#594026",
      sceneGridOpacity: 1.0,
      wallColor: "#9A6D54",
    })
  }, 
  water: {
    name: "Water",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#203246",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Water_001_COLOR.jpg",
      wallColor: "#203246",
      wallThickness: 5,
    })
  },  
  woodPlanks: {
    name: "Wood Planks",
    config: foundry.utils.mergeObject(defaultConfig(), {
      doorColor: "#332211",
      doorFillColor: "#FFFFFF",
      doorFillOpacity: 1.0, 
      floorTexture: "modules/dungeon-draw/assets/textures/Old_Wooden_Plank_Seamless_Texture_765.jpg",
      wallColor: "#332211",
      wallThickness: 10,
    })
  },
};
