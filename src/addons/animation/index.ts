import {
  animate,
  Animation,
  AnimationOptions,
  linear,
  easeInOut,
} from "popmotion";
import { ComponentUtils } from "../../dom";

export const createAnimation = <T>(
  utils: ComponentUtils,
  initialValue: any,
  options: AnimationOptions<T>
) => {
  const $signal = utils.signal("animation", initialValue);
  const animation = animate({
    ...options,
  });
  return [$signal, animation];
};
