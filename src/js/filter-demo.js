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
  previewRootSelector: '.demo__canvas__wrapper',
  filterCanvasSelector: '#filterCanvas',
  origCanvasSelector: '#origCanvas',
  imageSelector: '.demo__img--1',
  imageSelectSelector: '.demo__select--image',
  rangeRootSelector: '.demo__range',
  rangeInputSelector: '.demo__range__input--range',
  rangeNumberSelector: '.demo__range__number',
  optionButtonSelector: '.demo__option__button'
};

const defaultEffects = {
  custom: {
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
  },
  sharpen: {
    brightness: 0,
    contrast: 0.5,
    saturation: 0,
    hue: 0,
    alpha: 0.25,
    color: {
      r: 255,
      g: 255,
      b: 255
    }
  },
  soft: {
    brightness: 1,
    contrast: 0.5,
    saturation: 0,
    hue: 0,
    alpha: 0.1,
    color: {
      r: 255,
      g: 255,
      b: 255
    }
  },
  lovely: {
    brightness: 1,
    contrast: 0,
    saturation: 0.5,
    hue: 0,
    alpha: 0.15,
    color: {
      r: 255,
      g: 204,
      b: 178
    }
  },
  fancy: {
    brightness: 0.16,
    contrast: -0.09,
    saturation: 0.69,
    hue: 0,
    alpha: 0.4,
    color: {
      r: 236,
      g: 218,
      b: 241
    }
  },
  vintage: {
    brightness: 1,
    contrast: 1,
    saturation: -0.59,
    hue: -55,
    alpha: 0.11,
    color: {
      r: 250,
      g: 100,
      b: 221
    }
  },
  lomo: {
    brightness: 0.5,
    contrast: 1,
    saturation: 1,
    hue: 0,
    alpha: 0.1,
    color: {
      r: 180,
      g: 233,
      b: 180
    }
  }
};

class filterDemo {
  constructor(options) {
    const settings = Object.assign({}, defaults, options);
    const previewRoot = document.querySelector(settings.previewRootSelector);
    const imageSelectbox = document.querySelector(settings.imageSelectSelector);
    const rangeInput = document.querySelectorAll(settings.rangeInputSelector);
    const optionButton = document.querySelectorAll(
      settings.optionButtonSelector
    );
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
      filterCanvas: document.querySelector(settings.filterCanvasSelector),
      origCanvas: document.querySelector(settings.origCanvasSelector),
      image: document.querySelector(settings.imageSelector),
      optionButton,
      imageSelectbox,
      webGLFilter,
      colorPicker,
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
        this.changeRangeText(e.target, e.target.value);
        this.effects[effect] = e.target.value;
        this.changeEffect();
      };
    });

    colorPicker.onChange = color => {
      document.querySelector('.demo__button--picker').style.backgroundColor =
        color.rgbaString;

      this.effects.color = Object.assign(
        {},
        {
          r: color._rgba[0],
          g: color._rgba[1],
          b: color._rgba[2]
        }
      );

      this.changeEffect();
    };

    optionButton.forEach(button => {
      button.onclick = e => {
        if (e.target.className !== 'demo__option__button is--active') {
          const optionName = e.target.dataset.option;

          document
            .querySelector('.demo__option__button.is--active')
            .classList.remove('is--active');

          e.target.classList.add('is--active');

          this.effects = Object.assign({}, defaultEffects[optionName]);

          Object.keys(defaultEffects[optionName]).forEach(key => {
            this.setRange(key, defaultEffects[optionName][key]);
          });
        }
      };
    });

    previewRoot.onmousedown = e => {
      e.preventDefault();
      filterCanvas.style.opacity = 0;
    };

    previewRoot.onmouseup = e => {
      e.preventDefault();
      filterCanvas.style.opacity = 1;
    };
  }

  onLoad() {
    const { filterCanvas, image } = this;
    const filterCtx = filterCanvas.getContext('2d');
    const imageRatio = 600 / image.naturalWidth;

    filterCanvas.width = image.width;
    filterCanvas.height = Math.ceil(image.height * imageRatio);

    Object.assign(this, {
      filterCtx
    });

    this.changeImage('1');
  }

  changeImage(value) {
    const { filterCanvas, filterCtx, origCanvas } = this;
    this.image = document.querySelector(`.demo__img--${value}`);

    const imageRatio = 600 / this.image.naturalWidth;
    const origCtx = origCanvas.getContext('2d');

    filterCanvas.width = this.image.width;
    filterCanvas.height = Math.ceil(this.image.height * imageRatio);

    origCanvas.width = this.image.width;
    origCanvas.height = Math.ceil(this.image.height * imageRatio);

    filterCtx.clearRect(0, 0, 600, this.image.naturalHeight * imageRatio);
    filterCtx.drawImage(
      this.image,
      0,
      0,
      600,
      this.image.naturalHeight * imageRatio
    );

    origCtx.clearRect(0, 0, 600, this.image.naturalHeight * imageRatio);
    origCtx.drawImage(
      this.image,
      0,
      0,
      600,
      this.image.naturalHeight * imageRatio
    );
  }

  setRange(effectName, value) {
    const rootElement = document.querySelector(`.demo__range--${effectName}`);
    if (effectName !== 'color') {
      rootElement.querySelector(defaults.rangeInputSelector).value = value;
      rootElement.querySelector(defaults.rangeNumberSelector).innerHTML = value;
    } else {
      this.colorPicker.setColor(`rgb(${value.r}, ${value.g}, ${value.b})`);
    }
  }

  changeRangeText(rangeElement, value) {
    const rangeNumber = rangeElement.parentElement.querySelector(
      defaults.rangeNumberSelector
    );

    rangeNumber.innerHTML = value;
  }

  changeEffect() {
    const { image, filterCanvas, filterCtx, webGLFilter, effects } = this;
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

      if (effects.hue) {
        webGLFilter.addFilter('hue', Number(effects.hue));
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

      filteredImage = webGLFilter.apply(image);

      filterCtx.globalAlpha = 1;
      filterCtx.drawImage(
        this.image,
        0,
        0,
        filterCanvas.width,
        filterCanvas.height
      );

      if (effects.alpha) {
        filterCtx.globalAlpha = Number(effects.alpha);
      }
      filterCtx.drawImage(
        filteredImage,
        0,
        0,
        filterCanvas.width,
        filterCanvas.height
      );
      webGLFilter.reset();
    }
  }
}

$(() => {
  const App = new filterDemo();
  window.App = App;

  App.onLoad();
});
