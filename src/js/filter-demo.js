// Polyfills
'use strict';

// Polyfills
import 'babel-polyfill';

// 3rd-party dependencies
import $ from 'jquery';
import 'jquery-ui/ui/effect';
import Picker from 'vanilla-picker';
import * as _filter from './webGLImageFilter.js';

window.$ = $;
window.jQuery = $;

const defaults = {
  wrapperSelector: '.filter-demo',
  rootSelector: '.demo__main',
  previewRootSelector: '.demo__preview',
  canvasSelector: '#demoCanvas',
  imageSelector: '.demo__img--1',
  imageSelectSelector: '.demo__select--image',
  rangeRootSelector: '.demo__range',
  rangeInputSelector: '.demo__range__input--range',
  rangeNumberSelector: '.demo__range__number'
};

class filterDemo {
  constructor(options) {
    const settings = Object.assign({}, defaults, options);
    const imageSelectbox = document.querySelector(settings.imageSelectSelector);
    const rangeInput = document.querySelectorAll(settings.rangeInputSelector);
    const webGLFilter = new _filter.WebGLImageFilter();
    const colorPicker = new Picker({
      parent: document.querySelector('.demo__button--picker'),
      popup: 'top',
      color: '#ffffff',
      alpha: false
    });

    Object.assign(this, {
      settings,
      root: document.querySelector(settings.rootSelector),
      previewRoot: document.querySelector(settings.previewRootSelector),
      canvas: document.querySelector(settings.canvasSelector),
      image: document.querySelector(settings.imageSelector),
      imageSelectbox,
      webGLFilter,
      effects: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        alpha: 0.25,
        color: {
          r: 255,
          g: 255,
          b: 255
        }
      }
    });

    imageSelectbox.onchange = e => {
      this.changeImage(e.target.value);
      this.changeEffect();
    };

    rangeInput.forEach(item => {
      item.oninput = e => {
        const effect = e.target.dataset.effect;
        this.changeValueText(e.target, e.target.value);
        this.effects[effect] = e.target.value;
        this.changeEffect();
      };
    });

    colorPicker.onChange = color => {
      document.querySelector('.demo__button--picker').style.backgroundColor =
        color.rgbaString;

      this.effects.color.r = color._rgba[0];
      this.effects.color.g = color._rgba[1];
      this.effects.color.b = color._rgba[2];

      this.changeEffect();
    };
  }

  onLoad() {
    const { canvas, image } = this;
    const ctx = canvas.getContext('2d');
    const imageRatio = 600 / image.naturalWidth;

    canvas.width = image.width;

    canvas.height = image.height * imageRatio;

    Object.assign(this, {
      ctx
    });

    this.changeImage('1');
  }

  changeImage(value) {
    const { canvas, ctx } = this;
    this.image = document.querySelector(`.demo__img--${value}`);

    const imageRatio = 600 / this.image.naturalWidth;

    canvas.width = this.image.width;
    canvas.height = this.image.height * imageRatio;

    ctx.clearRect(0, 0, 600, this.image.naturalHeight * imageRatio);
    ctx.drawImage(this.image, 0, 0, 600, this.image.naturalHeight * imageRatio);
  }

  changeValueText(rangeElement, value) {
    const rangeNumber = rangeElement.parentElement.querySelector(
      defaults.rangeNumberSelector
    );

    rangeNumber.innerHTML = value;
  }

  changeEffect() {
    const { image, canvas, ctx, webGLFilter, effects } = this;
    let filteredImage;

    if (
      Number(effects.brightness) ||
      Number(effects.contrast) ||
      Number(effects.saturation) ||
      Number(effects.hue) ||
      Number(effects.alpha) ||
      effects.color
    ) {
      if (effects.color) {
        webGLFilter.addFilter('customColor', [
          Number(effects.color.r) / 255,
          0,
          0,
          0,
          0,
          0,
          Number(effects.color.g) / 255,
          0,
          0,
          0,
          0,
          0,
          Number(effects.color.b) / 255,
          0,
          0,
          0,
          0,
          0,
          1,
          0
        ]);
      }

      if (effects.brightness) {
        webGLFilter.addFilter('brightness', Number(effects.brightness));
      }

      if (effects.contrast) {
        webGLFilter.addFilter('contrast', Number(effects.contrast));
      }

      if (effects.saturation) {
        webGLFilter.addFilter('saturation', Number(effects.saturation));
      }

      if (effects.hue) {
        webGLFilter.addFilter('hue', Number(effects.hue));
      }

      filteredImage = webGLFilter.apply(image);

      ctx.globalAlpha = 1;
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

      if (effects.alpha) {
        ctx.globalAlpha = Number(effects.alpha);
      }
      ctx.drawImage(filteredImage, 0, 0, canvas.width, canvas.height);
      webGLFilter.reset();
    }
  }
}

$(() => {
  const App = new filterDemo();
  window.App = App;

  App.onLoad();
});
