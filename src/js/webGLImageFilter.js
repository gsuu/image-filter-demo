/*
WebGLImageFilter - MIT Licensed

2013, Dominic Szablewski - phoboslab.org
*/

export function WebGLProgram(gl, vertexSource, fragmentSource) {
  var _collect = function(source, prefix, collection) {
    var r = new RegExp('\\b' + prefix + ' \\w+ (\\w+)', 'ig');
    source.replace(r, function(match, name) {
      collection[name] = 0;
      return match;
    });
  };

  var _compile = function(gl, source, type) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };

  this.uniform = {};
  this.attribute = {};

  var _vsh = _compile(gl, vertexSource, gl.VERTEX_SHADER);
  var _fsh = _compile(gl, fragmentSource, gl.FRAGMENT_SHADER);

  this.id = gl.createProgram();
  gl.attachShader(this.id, _vsh);
  gl.attachShader(this.id, _fsh);
  gl.linkProgram(this.id);

  if (!gl.getProgramParameter(this.id, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(this.id));
  }

  gl.useProgram(this.id);

  // Collect attributes
  _collect(vertexSource, 'attribute', this.attribute);
  for (var a in this.attribute) {
    this.attribute[a] = gl.getAttribLocation(this.id, a);
  }

  // Collect uniforms
  _collect(vertexSource, 'uniform', this.uniform);
  _collect(fragmentSource, 'uniform', this.uniform);
  for (var u in this.uniform) {
    this.uniform[u] = gl.getUniformLocation(this.id, u);
  }
}

export function WebGLImageFilter() {
  var gl = null,
    _drawCount = 0,
    _sourceTexture = null,
    _lastInChain = false,
    _currentFramebufferIndex = -1,
    _tempFramebuffers = [null, null],
    _filterChain = [],
    _width = -1,
    _height = -1,
    _vertexBuffer = null,
    _currentProgram = null,
    _canvas = document.createElement('canvas');

  var gl =
    _canvas.getContext('webgl') || _canvas.getContext('experimental-webgl');
  if (!gl) {
    throw "Couldn't get WebGL context";
  }

  this.addFilter = function(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    var filter = _filter[name];

    _filterChain.push({ func: filter, args: args });
  };

  this.reset = function() {
    _filterChain = [];
  };

  this.apply = function(image) {
    _resize(image.width, image.height);
    _drawCount = 0;

    // No filters? Just draw
    if (_filterChain.length == 0) {
      _draw();
    }

    // Create the texture for the input image
    _sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, _sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    for (var i = 0; i < _filterChain.length; i++) {
      _lastInChain = i == _filterChain.length - 1;
      var f = _filterChain[i];

      f.func.apply(this, f.args || []);
    }

    return _canvas;
  };

  var _resize = function(width, height) {
    // Same width/height? Nothing to do here
    if (width == _width && height == _height) {
      return;
    }

    _canvas.width = _width = width;
    _canvas.height = _height = height;

    // Create the context if we don't have it yet
    if (!_vertexBuffer) {
      // Create the vertex buffer for the two triangles [x, y, v, w] * 6
      var vertices = new Float32Array([
        -1,
        -1,
        0,
        1,
        1,
        -1,
        1,
        1,
        -1,
        1,
        0,
        0,
        -1,
        1,
        0,
        0,
        1,
        -1,
        1,
        1,
        1,
        1,
        1,
        0
      ]);
      (_vertexBuffer = gl.createBuffer()),
        gl.bindBuffer(gl.ARRAY_BUFFER, _vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      // Note sure if this is a good idea; at least it makes texture loading
      // in Ejecta instant.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    }

    gl.viewport(0, 0, _width, _height);

    // Delete old temp framebuffers
    _tempFramebuffers = [null, null];
  };

  var _getTempFramebuffer = function(index) {
    _tempFramebuffers[index] =
      _tempFramebuffers[index] || _createFramebufferTexture(_width, _height);

    return _tempFramebuffers[index];
  };

  var _createFramebufferTexture = function(width, height) {
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    var renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo: fbo, texture: texture };
  };

  var _draw = function(flags) {
    var source = null,
      target = null,
      flipY = false;

    // Set up the source
    if (_drawCount == 0) {
      // First draw call - use the source texture
      source = _sourceTexture;
    } else {
      // All following draw calls use the temp buffer last drawn to
      source = _getTempFramebuffer(_currentFramebufferIndex).texture;
    }
    _drawCount++;

    // Set up the target
    if (_lastInChain && !(flags & DRAW.INTERMEDIATE)) {
      // Last filter in our chain - draw directly to the WebGL Canvas. We may
      // also have to flip the image vertically now
      target = null;
      flipY = _drawCount % 2 == 0;
    } else {
      // Intermediate draw call - get a temp buffer to draw to
      _currentFramebufferIndex = (_currentFramebufferIndex + 1) % 2;
      target = _getTempFramebuffer(_currentFramebufferIndex).fbo;
    }

    // Bind the source and target and draw the two triangles
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);

    gl.uniform1f(_currentProgram.uniform.flipY, flipY ? -1 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  var _compileShader = function(fragmentSource) {
    if (fragmentSource.__program) {
      _currentProgram = fragmentSource.__program;
      gl.useProgram(_currentProgram.id);
      return _currentProgram;
    }

    // Compile shaders
    _currentProgram = new WebGLProgram(
      gl,
      SHADER.VERTEX_IDENTITY,
      fragmentSource
    );

    var floatSize = Float32Array.BYTES_PER_ELEMENT;
    var vertSize = 4 * floatSize;
    gl.enableVertexAttribArray(_currentProgram.attribute.pos);
    gl.vertexAttribPointer(
      _currentProgram.attribute.pos,
      2,
      gl.FLOAT,
      false,
      vertSize,
      0 * floatSize
    );
    gl.enableVertexAttribArray(_currentProgram.attribute.uv);
    gl.vertexAttribPointer(
      _currentProgram.attribute.uv,
      2,
      gl.FLOAT,
      false,
      vertSize,
      2 * floatSize
    );

    // fragmentSource.__program = _currentProgram;
    return _currentProgram;
  };

  var DRAW = { INTERMEDIATE: 1 };

  var SHADER = {};
  SHADER.VERTEX_IDENTITY = `precision mediump float;
    attribute vec2 pos;
    attribute vec2 uv;
    varying vec2 vUv;
    uniform float flipY;

    attribute vec4 position;
    attribute vec4 texcoord;
    uniform mat4 u_matrix;
    uniform mat4 u_texMatrix;
    varying vec2 vTexCoord;

    void main(void) {
    vUv = uv;
    gl_Position = vec4(pos.x, pos.y*flipY, 0.0, 1.);
    vTexCoord = (u_texMatrix * texcoord).xy;
  }`;

  SHADER.FRAGMENT_IDENTITY =
    'precision mediump float;\n' +
    'varying vec2 vUv;\n' +
    'uniform sampler2D texture;\n\n' +
    'void main(void) {\n' +
    'gl_FragColor = texture2D(texture, vUv);\n' +
    '}';

  var _filter = {};

  // ----------------------------------------------------------------------------
  // Color Matrix Filter

  _filter.colorMatrix = function(matrix) {
    // Create a Float32 Array and normalize the offset component to 0-1
    var m = new Float32Array(matrix);
    m[4] /= 255;
    m[9] /= 255;
    m[14] /= 255;
    m[19] /= 255;

    // Can we ignore the alpha value? Makes things a bit faster.
    var shader =
      1 == m[18] &&
      0 == m[3] &&
      0 == m[8] &&
      0 == m[13] &&
      0 == m[15] &&
      0 == m[16] &&
      0 == m[17] &&
      0 == m[19]
        ? _filter.colorMatrix.SHADER.WITHOUT_ALPHA
        : _filter.colorMatrix.SHADER.WITH_ALPHA;

    var program = _compileShader(shader);
    gl.uniform1fv(program.uniform.m, m);
    _draw();
  };

  _filter.colorMatrix.SHADER = {};
  _filter.colorMatrix.SHADER.WITH_ALPHA = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D texture;',
    'uniform float m[20];',

    'void main(void) {',
    'vec4 c = texture2D(texture, vUv);',
    'gl_FragColor.r = m[0] * c.r + m[1] * c.g + m[2] * c.b + m[3] * c.a + m[4];',
    'gl_FragColor.g = m[5] * c.r + m[6] * c.g + m[7] * c.b + m[8] * c.a + m[9];',
    'gl_FragColor.b = m[10] * c.r + m[11] * c.g + m[12] * c.b + m[13] * c.a + m[14];',
    'gl_FragColor.a = m[15] * c.r + m[16] * c.g + m[17] * c.b + m[18] * c.a + m[19];',
    '}'
  ].join('\n');
  _filter.colorMatrix.SHADER.WITHOUT_ALPHA = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D texture;',
    'uniform float m[20];',

    'void main(void) {',
    'vec4 c = texture2D(texture, vUv);',
    'gl_FragColor.r = m[0] * c.r + m[1] * c.g + m[2] * c.b + m[4];',
    'gl_FragColor.g = m[5] * c.r + m[6] * c.g + m[7] * c.b + m[9];',
    'gl_FragColor.b = m[10] * c.r + m[11] * c.g + m[12] * c.b + m[14];',
    'gl_FragColor.a = c.a;',
    '}'
  ].join('\n');

  _filter.brightness = function(brightness) {
    var b = (brightness || 0) + 1;
    _filter.colorMatrix([
      b,
      0,
      0,
      0,
      0,
      0,
      b,
      0,
      0,
      0,
      0,
      0,
      b,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.saturation = function(amount) {
    var x = ((amount || 0) * 2) / 3 + 1;
    var y = (x - 1) * -0.5;
    _filter.colorMatrix([
      x,
      y,
      y,
      0,
      0,
      y,
      x,
      y,
      0,
      0,
      y,
      y,
      x,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.contrast = function(amount) {
    var v = (amount || 0) + 1;
    var o = -128 * (v - 1);

    _filter.colorMatrix([
      v,
      0,
      0,
      0,
      o,
      0,
      v,
      0,
      0,
      o,
      0,
      0,
      v,
      0,
      o,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.negative = function() {
    _filter.contrast(-2);
  };

  _filter.hue = function(rotation) {
    rotation = ((rotation || 0) / 180) * Math.PI;
    var cos = Math.cos(rotation),
      sin = Math.sin(rotation),
      lumR = 0.213,
      lumG = 0.715,
      lumB = 0.072;

    _filter.colorMatrix([
      lumR + cos * (1 - lumR) + sin * -lumR,
      lumG + cos * -lumG + sin * -lumG,
      lumB + cos * -lumB + sin * (1 - lumB),
      0,
      0,
      lumR + cos * -lumR + sin * 0.143,
      lumG + cos * (1 - lumG) + sin * 0.14,
      lumB + cos * -lumB + sin * -0.283,
      0,
      0,
      lumR + cos * -lumR + sin * -(1 - lumR),
      lumG + cos * -lumG + sin * lumG,
      lumB + cos * (1 - lumB) + sin * lumB,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.desaturateLuminance = function() {
    _filter.colorMatrix([
      0.2764723,
      0.929708,
      0.0938197,
      0,
      -20.1,
      0.2764723,
      0.929708,
      0.0938197,
      0,
      -20.1,
      0.2764723,
      0.929708,
      0.0938197,
      0,
      -20.1,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.sepia = function() {
    _filter.colorMatrix([
      0.393,
      0.7689999,
      0.18899999,
      0,
      0,
      0.349,
      0.6859999,
      0.16799999,
      0,
      0,
      0.272,
      0.5339999,
      0.13099999,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.brownie = function() {
    _filter.colorMatrix([
      0.5997023498159715,
      0.34553243048391263,
      -0.2708298674538042,
      0,
      47.43192855600873,
      -0.037703249837783157,
      0.8609577587992641,
      0.15059552388459913,
      0,
      -36.96841498319127,
      0.24113635128153335,
      -0.07441037908422492,
      0.44972182064877153,
      0,
      -7.562075277591283,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.vintagePinhole = function() {
    _filter.colorMatrix([
      0.6279345635605994,
      0.3202183420819367,
      -0.03965408211312453,
      0,
      9.651285835294123,
      0.02578397704808868,
      0.6441188644374771,
      0.03259127616149294,
      0,
      7.462829176470591,
      0.0466055556782719,
      -0.0851232987247891,
      0.5241648018700465,
      0,
      5.159190588235296,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.kodachrome = function() {
    _filter.colorMatrix([
      1.1285582396593525,
      -0.3967382283601348,
      -0.03992559172921793,
      0,
      63.72958762196502,
      -0.16404339962244616,
      1.0835251566291304,
      -0.05498805115633132,
      0,
      24.732407896706203,
      -0.16786010706155763,
      -0.5603416277695248,
      1.6014850761964943,
      0,
      35.62982807460946,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.technicolor = function() {
    _filter.colorMatrix([
      1.9125277891456083,
      -0.8545344976951645,
      -0.09155508482755585,
      0,
      11.793603434377337,
      -0.3087833385928097,
      1.7658908555458428,
      -0.10601743074722245,
      0,
      -70.35205161461398,
      -0.231103377548616,
      -0.7501899197440212,
      1.847597816108189,
      0,
      30.950940869491138,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.pinkcolor = function() {
    _filter.colorMatrix([
      1.9125277891456083,
      -0.8545344976951645,
      0.1155508482755585,
      0.5,
      10.793603434377337,
      -0.3087833385928097,
      1.9658908555458428,
      -0.10601743074722245,
      0.3,
      -70.35205161461398,
      -0.231103377548616,
      -0.7501899197440212,
      1.847597816108189,
      0,
      29.950940869491138,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.polaroid = function() {
    _filter.colorMatrix([
      1.438,
      -0.062,
      -0.062,
      0,
      0,
      -0.122,
      1.378,
      -0.122,
      0,
      0,
      -0.016,
      -0.016,
      1.483,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.predator = function(amount) {
    _filter.colorMatrix([
      // row 1
      11.224130630493164 * amount,
      -4.794486999511719 * amount,
      -2.8746118545532227 * amount,
      0 * amount,
      0.40342438220977783 * amount,
      // row 2
      -3.6330697536468506 * amount,
      9.193157196044922 * amount,
      -2.951810836791992 * amount,
      0 * amount,
      -1.316135048866272 * amount,
      // row 3
      -3.2184197902679443 * amount,
      -4.2375030517578125 * amount,
      7.476448059082031 * amount,
      0 * amount,
      0.8044459223747253 * amount,
      // row 4
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.lsd = function() {
    _filter.colorMatrix([
      2,
      -0.4,
      0.5,
      0,
      0,
      -0.5,
      2,
      -0.4,
      0,
      0,
      -0.4,
      -0.5,
      3,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.red = function() {
    _filter.colorMatrix([
      1.6,
      0.2,
      0,
      0,
      0,
      0,
      0.8,
      0,
      0,
      0,
      0,
      0,
      0.7,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.yellow = function(amount) {
    var v = (amount || 0) + 1;
    _filter.colorMatrix([
      v - 0.01 * amount,
      0,
      0,
      0,
      0,
      0,
      v - 0.7 * amount,
      0,
      0,
      -0.5 * amount,
      -0.5 * amount,
      0,
      v - 0.7 * amount,
      -0.5 * amount,
      -0.5 * amount,
      -0.5 * amount,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.blue = function(amount) {
    var v = (amount || 0) + 1;
    _filter.colorMatrix([
      v - 0.7 * amount,
      -0.5 * amount,
      -0.5 * amount,
      -0.5 * amount,
      0,
      0,
      v - 0.7 * amount,
      -0.5 * amount,
      -0.5 * amount,
      -0.5 * amount,
      0,
      0,
      v - 0.01 * amount,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.lomo = function() {
    _filter.colorMatrix([
      1.2,
      0,
      0,
      0,
      0,
      0,
      1.56,
      0,
      0,
      0,
      0,
      0,
      1.2,
      0,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.vintage = function() {
    _filter.colorMatrix([
      5,
      2,
      0,
      0,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      0,
      1,
      0
    ]);
  };

  _filter.customColor = function(matrix) {
    _filter.colorMatrix(matrix);
  };

  // ----------------------------------------------------------------------------
  // Convolution Filter

  _filter.convolution = function(matrix) {
    var m = new Float32Array(matrix);
    var pixelSizeX = 1 / _width;
    var pixelSizeY = 1 / _height;

    var program = _compileShader(_filter.convolution.SHADER);
    gl.uniform1fv(program.uniform.m, m);
    gl.uniform2f(program.uniform.px, pixelSizeX, pixelSizeY);
    _draw();
  };

  _filter.convolution.SHADER = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D texture;',
    'uniform vec2 px;',
    'uniform float m[9];',

    'void main(void) {',
    'vec4 c11 = texture2D(texture, vUv - px);', // top left
    'vec4 c12 = texture2D(texture, vec2(vUv.x, vUv.y - px.y));', // top center
    'vec4 c13 = texture2D(texture, vec2(vUv.x + px.x, vUv.y - px.y));', // top right

    'vec4 c21 = texture2D(texture, vec2(vUv.x - px.x, vUv.y) );', // mid left
    'vec4 c22 = texture2D(texture, vUv);', // mid center
    'vec4 c23 = texture2D(texture, vec2(vUv.x + px.x, vUv.y) );', // mid right

    'vec4 c31 = texture2D(texture, vec2(vUv.x - px.x, vUv.y + px.y) );', // bottom left
    'vec4 c32 = texture2D(texture, vec2(vUv.x, vUv.y + px.y) );', // bottom center
    'vec4 c33 = texture2D(texture, vUv + px );', // bottom right

    'gl_FragColor = ',
    'c11 * m[0] + c12 * m[1] + c13 * m[2] +',
    'c21 * m[3] + c22 * m[4] + c23 * m[5] +',
    'c31 * m[6] + c32 * m[7] + c33 * m[8];',
    'gl_FragColor.a = c22.a;',
    '}'
  ].join('\n');

  _filter.detectEdges = function() {
    _filter.convolution.call(this, [0, 1, 0, 1 - 4, 1, 0, 1, 0]);
  };

  _filter.sharpen = function(amount) {
    _filter.convolution.call(this, [
      0,
      -1 * amount,
      0,
      -1 * amount,
      1 + 8 * amount,
      -1 * amount,
      0,
      -1 * amount,
      0
    ]);
  };

  _filter.unSharpMask = function(amount) {
    _filter.convolution.call(this, [
      -1 * amount,
      -1 * amount,
      -1 * amount,
      -1 * amount,
      1 + 8 * amount,
      -1 * amount,
      -1 * amount,
      -1 * amount,
      -1 * amount
    ]);
  };

  _filter.gaussianBlur = function(amount) {
    var a = amount;
    _filter.convolution.call(this, [
      0.111 * a,
      0.111 * a,
      0.111 * a,
      0.111 * a,
      0.111 * a,
      0.111 * a,
      0.111 * a,
      0.111 * a,
      0.111 * a
    ]);
  };

  _filter.emboss = function(size) {
    var s = size;
    _filter.convolution.call(this, [
      -2 * s,
      -1 * s,
      0,
      -1 * s,
      1,
      1 * s,
      0,
      1 * s,
      2 * s
    ]);
  };

  // ----------------------------------------------------------------------------
  // Blur Filter

  _filter.blur = function(size) {
    var blurSizeX = size / 7 / _width;
    var blurSizeY = size / 7 / _height;

    var program = _compileShader(_filter.blur.SHADER);

    // Vertical
    gl.uniform2f(program.uniform.px, 0, blurSizeY);
    _draw(DRAW.INTERMEDIATE);

    // Horizontal
    gl.uniform2f(program.uniform.px, blurSizeX, 0);
    _draw();
  };

  _filter.blur.SHADER = [
    'precision mediump float;',
    'varying vec2 vUv;', //vTexCoord
    'uniform sampler2D texture;',
    'uniform vec2 px;',

    'void main(void) {',
    'gl_FragColor = vec4(0.0);',
    'gl_FragColor += texture2D(texture, vUv + vec2(-7.0*px.x, -7.0*px.y))*0.0044299121055113265;',
    'gl_FragColor += texture2D(texture, vUv + vec2(-6.0*px.x, -6.0*px.y))*0.00895781211794;',
    'gl_FragColor += texture2D(texture, vUv + vec2(-5.0*px.x, -5.0*px.y))*0.0215963866053;',
    'gl_FragColor += texture2D(texture, vUv + vec2(-4.0*px.x, -4.0*px.y))*0.0443683338718;',
    'gl_FragColor += texture2D(texture, vUv + vec2(-3.0*px.x, -3.0*px.y))*0.0776744219933;',
    'gl_FragColor += texture2D(texture, vUv + vec2(-2.0*px.x, -2.0*px.y))*0.115876621105;',
    'gl_FragColor += texture2D(texture, vUv + vec2(-1.0*px.x, -1.0*px.y))*0.147308056121;',
    'gl_FragColor += texture2D(texture, vUv                             )*0.159576912161;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 1.0*px.x,  1.0*px.y))*0.147308056121;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 2.0*px.x,  2.0*px.y))*0.115876621105;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 3.0*px.x,  3.0*px.y))*0.0776744219933;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 4.0*px.x,  4.0*px.y))*0.0443683338718;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 5.0*px.x,  5.0*px.y))*0.0215963866053;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 6.0*px.x,  6.0*px.y))*0.00895781211794;',
    'gl_FragColor += texture2D(texture, vUv + vec2( 7.0*px.x,  7.0*px.y))*0.0044299121055113265;',
    '}'
  ].join('\n');

  _filter.sharpeness = function(amount) {
    var program = _compileShader(_filter.sharpeness.SHADER);

    gl.uniform2fv(
      program.uniform.sourceSize,
      new Float32Array([1 / _width, 1 / _height])
    );
    gl.uniform1f(program.uniform.saturation, 1);
    gl.uniform1f(program.uniform.warmth, 0);
    gl.uniform1f(program.uniform.sharpen, amount);
    gl.uniform1f(program.uniform.blur, 1 + amount);
    gl.uniform1f(program.uniform.brightness, 1);
    gl.uniform1f(program.uniform.contrast, 1);
    gl.uniform1f(program.uniform.grey, 1);
    gl.uniform1f(program.uniform.vignette, 10);
    _draw();
  };

  _filter.sharpeness.SHADER = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D texture;',
    'uniform vec2 sourceSize;',
    'uniform float saturation;',
    'uniform float warmth;',
    'uniform float sharpen;',
    'uniform float brightness;',
    'uniform float contrast;',
    'uniform float blur;',
    'uniform float vignette;',
    'uniform float grey;',

    'vec3 saturationVector = vec3(0.299, 0.587, 0.114);',

    'void main() {',
    'vec2 off = sourceSize * blur;',
    'vec2 off2 = off * 2.0;',

    'vec4 tex00 = texture2D(texture, vUv + vec2(-off2.x, -off2.y));',
    'vec4 tex10 = texture2D(texture, vUv + vec2(-off.x, -off2.y));',
    'vec4 tex20 = texture2D(texture, vUv + vec2(0.0, -off2.y));',
    'vec4 tex30 = texture2D(texture, vUv + vec2(off.x, -off2.y));',
    'vec4 tex40 = texture2D(texture, vUv + vec2(off2.x, -off2.y));',

    'vec4 tex01 = texture2D(texture, vUv + vec2(-off2.x, -off.y));',
    'vec4 tex11 = texture2D(texture, vUv + vec2(-off.x, -off.y));',
    'vec4 tex21 = texture2D(texture, vUv + vec2(0.0, -off.y));',
    'vec4 tex31 = texture2D(texture, vUv + vec2(off.x, -off.y));',
    'vec4 tex41 = texture2D(texture, vUv + vec2(off2.x, -off.y));',

    'vec4 tex02 = texture2D(texture, vUv + vec2(-off2.x, 0.0));',
    'vec4 tex12 = texture2D(texture, vUv + vec2(-off.x, 0.0));',
    'vec4 tex22 = texture2D(texture, vUv + vec2(0.0, 0.0));',
    'vec4 tex32 = texture2D(texture, vUv + vec2(off.x, 0.0));',
    'vec4 tex42 = texture2D(texture, vUv + vec2(off2.x, 0.0));',

    'vec4 tex03 = texture2D(texture, vUv + vec2(-off2.x, off.y));',
    'vec4 tex13 = texture2D(texture, vUv + vec2(-off.x, off.y));',
    'vec4 tex23 = texture2D(texture, vUv + vec2(0.0, off.y));',
    'vec4 tex33 = texture2D(texture, vUv + vec2(off.x, off.y));',
    'vec4 tex43 = texture2D(texture, vUv + vec2(off2.x, off.y));',
    'vec4 tex04 = texture2D(texture, vUv + vec2(-off2.x, off2.y));',
    'vec4 tex14 = texture2D(texture, vUv + vec2(-off.x, off2.y));',
    'vec4 tex24 = texture2D(texture, vUv + vec2(0.0, off2.y));',
    'vec4 tex34 = texture2D(texture, vUv + vec2(off.x, off2.y));',
    'vec4 tex44 = texture2D(texture, vUv + vec2(off2.x, off2.y));',
    'vec4 tex = tex22;',

    'vec4 blurred = 1.0 * tex00 + 4.0 * tex10 + 6.0 * tex20 + 4.0 * tex30 + 1.0 * tex40',
    '+ 4.0 * tex01 + 16.0 * tex11 + 24.0 * tex21 + 16.0 * tex31 + 4.0 * tex41',
    '+ 6.0 * tex02 + 24.0 * tex12 + 36.0 * tex22 + 24.0 * tex32 + 6.0 * tex42',
    '+ 4.0 * tex03 + 16.0 * tex13 + 24.0 * tex23 + 16.0 * tex33 + 4.0 * tex43',
    '+ 1.0 * tex04 + 4.0 * tex14 + 6.0 * tex24 + 4.0 * tex34 + 1.0 * tex44;',
    'blurred /= 256.0;',
    'tex += (tex - blurred) * sharpen;',
    'vec3 desaturated = vec3(dot(saturationVector, tex.rgb));',
    'vec3 mixed = mix(desaturated, tex.rgb, saturation);',
    'vec4 color = vec4(mixed, tex.a);',
    'color.r += warmth;',
    'color.b -= warmth;',
    'vec3 greyVec = vec3(grey, grey, grey);',
    'color.rgb = mix(color.rgb * brightness, mix(greyVec, color.rgb, contrast), 0.5);',
    'float ratio = off.x / off.y;',
    'float dist = sqrt(pow(vUv.x - 0.5, 2.0) + pow(ratio * (vUv.y - 0.5), 2.0));',
    'float vigCurve = exp(-pow(dist, 2.0) / (2.0 * pow(-vignette, 2.0)));',
    'color.rgb *= vigCurve;',
    'gl_FragColor = color;',
    '}'
  ].join('\n');
}
