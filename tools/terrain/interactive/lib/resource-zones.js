export const RESOURCE_ZONE_STYLES = {
  wind: {
    label: "Wind",
    fill: "rgba(106, 212, 255, 0.28)",
    stroke: "rgba(138, 223, 255, 0.92)",
  },
  sun: {
    label: "Sun",
    fill: "rgba(255, 210, 97, 0.28)",
    stroke: "rgba(255, 223, 142, 0.96)",
  },
  gas: {
    label: "Natural Gas",
    fill: "rgba(144, 192, 255, 0.24)",
    stroke: "rgba(172, 209, 255, 0.94)",
  },
};

export function getResourceStyle(type) {
  return RESOURCE_ZONE_STYLES[type] || RESOURCE_ZONE_STYLES.wind;
}

export function resourceTypeLabel(type) {
  return getResourceStyle(type).label;
}
