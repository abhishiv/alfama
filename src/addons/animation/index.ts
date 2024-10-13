import { ComponentUtils } from "../../dom";

export const createAnimation = <T>(
  utils: ComponentUtils,
  initialValue: any
) => {
  const $signal = utils.signal("animation", initialValue);
  return [$signal];
};
