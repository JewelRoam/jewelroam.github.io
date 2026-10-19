export const embeddedProjects = {
  zaichang: {
    label: "ZaiChang",
    title: "在场",
    description: "把专注、同桌、留声和回忆收进同一间安静小屋的陪伴空间。",
    path: "/zaichang",
    src: "https://jewelroam.github.io/ZaiChang/",
  },
  "glyph-atlas": {
    label: "Glyph Atlas",
    title: "Glyph Atlas 字脉",
    description: "把人类书写体系的演化关系画成一张可缩放、可漫游的有向图。",
    path: "/glyph-atlas",
    src: "https://jewelroam.github.io/Glyph-Atlas/",
  },
  "nexus-pilot": {
    label: "NexusPilot",
    title: "NexusPilot",
    description: "连接视觉感知、运动规划与车际通信，在 CARLA 模拟和树莓派 5 实车上验证的协同自动驾驶系统。",
    path: "/nexus-pilot",
    src: "https://jewelroam.github.io/NexusPilot/",
  },
  geekday: {
    label: "23.5°N GEEKDAY",
    title: "23.5°N GEEKDAY 北回归线极客节",
    description: "在潮汕举办的 48 小时黑客马拉松与极客节，聚焦 AI Agent 与具身智能。",
    path: "/geekday",
    src: "https://23-5-n-geekday.github.io/",
  },
} as const;

export type EmbeddedProjectId = keyof typeof embeddedProjects;
