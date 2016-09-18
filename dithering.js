var canvas, context;
var originalImage, originalData;
var progressBar, applyButton;

var bayerMatrix2x2 = prepareBayerMatrix([
  [1, 3],
  [4, 2]
]);

var bayerMatrix4x4 = prepareBayerMatrix([
  [ 1,  9,  3, 11],
  [13,  5, 15,  7],
  [ 4, 12,  2, 10],
  [16,  8, 14,  6]
]);

var bayerMatrix8x8 = prepareBayerMatrix([
  [ 1, 49, 13, 61,  4, 52, 16, 64],
  [33, 17, 45, 29, 36, 20, 48, 32],
  [ 9, 57,  5, 53, 12, 60,  8, 56],
  [41, 25, 37, 21, 44, 28, 40, 24],
  [ 3, 51, 15, 63,  2, 50, 14, 62],
  [35, 19, 47, 31, 34, 18, 46, 30],
  [11, 59,  7, 55, 10, 58,  6, 54],
  [43, 27, 39, 23, 42, 26, 38, 22]
]);

var palettes = {
  'blackWhite': [
    [0, 0, 0],
    [255, 255, 255]],
  '2bitGreyscale': [
    [0, 0, 0],
    [148, 148, 148],
    [208, 208, 208],
    [255, 255, 255]],
  'additive': [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [0, 0, 0]],
  'subtractive': [
    [255, 0, 0],
    [255, 255, 0],
    [0, 102, 255],
    [255, 255, 255],
    [0, 0, 0]],
  'printer': [
    [255, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 255, 255],
    [0, 0, 0]],
  '3bitRGB': [
    [0, 0, 0],
    [0, 0, 255],
    [0, 255, 0],
    [0, 255, 255],
    [255, 0, 0],
    [255, 0, 255],
    [255, 255, 255]],
  'mnmColours': [
    [230, 30, 50],
    [255, 80, 10],
    [250, 220, 10],
    [10, 180, 40],
    [0, 110, 230],
    [70, 30, 20]]
};

function $(id) {
  return document.getElementById(id);
}

function addClass(e, cls) {
  e.className += ' ' + cls;
}

function removeClass(e, cls) {
  e.className = e.className.replace(new RegExp('(^| )'+cls+'($| )'), '');
}

function prepareBayerMatrix(matrix) {
  var scaleFactor = 1 / (matrix.length * matrix.length + 1);
  var result = [];
  for (var i = 0; i < matrix.length; ++i) {
    var row = [];
    for (var j = 0; j < matrix.length; ++j) {
      row.push(1 + scaleFactor * matrix[i][j]);
    }
    result.push(row);
  }

  return result;
}

var ditherFunctions = {
  'thresholding': function(c) { thresholding(c) },
  'bayer2x2': function(c) { bayer(bayerMatrix2x2, c); },
  'bayer4x4': function(c) { bayer(bayerMatrix4x4, c); },
  'bayer8x8': function(c) { bayer(bayerMatrix8x8, c); },
  'floydSteinberg': function(c) { floydSteinberg(c); }
};

document.addEventListener('DOMContentLoaded', function() {
  setup();
});

function setup() {
  canvas = $('demo');
  context = canvas.getContext('2d');
  originalImage = $('tiger_img');
  if (originalImage.complete) {
    drawOriginalImage();
  } else {
    originalImage.addEventListener('load', drawOriginalImage);
  }

  progressBar = $('progressBar');
  applyButton = $('applyButton');
  applyButton.addEventListener('click', function(event) {
    removeClass(progressBar, 'hidden');
    addClass(event.target, 'hidden');
    setTimeout(function() {
      ditherFunctions[$('ditherType').value](
        palettes[$('colourPalette').value]);
      setTimeout(function() {
        removeClass(event.target, 'hidden');
        addClass(progressBar, 'hidden');
      }, 0);
    }, 0);
  });
  $('resetButton').addEventListener('click', drawOriginalImage);
}

function Point(x, y) {
  this.x = x;
  this.y = y;
}

function rgba(red, green, blue, alpha) {
  return "rgba(" + Math.floor(red) + ", " + Math.floor(green) + ", " +
    Math.floor(blue) + ", " + alpha + ")";
}

function rgb(red, green, blue) {
  return rgba(red, green, blue, 1);
}

function drawOriginalImage() {
  context.drawImage(originalImage, 0, 0);
  originalData = context.getImageData(0, 0, canvas.width, canvas.height).data;
}

function clamp(n, lower, upper) {
  if (n < lower)
    return lower;
  if (n > upper)
    return upper;
  return n;
}

function gamma(n) {
  return Math.pow(n, 0.5);
}

function degamma(n) {
  return Math.pow(n, 2);
}

function addSquare(a, b) {
  return a + b*b;
}

function arrayCopy() {
  var from, fromStart, to, toStart, length;
  if (arguments.length == 2) {
    from = arguments[0];
    to = arguments[1];
    fromStart = toStart = 0;
    length = from.length;
  } else {
    from = arguments[0];
    fromStart = arguments[1];
    to = arguments[2];
    toStart = arguments[3];
    length = arguments[4];
  }

  for (var i = 0; i < length; ++i) {
    to[toStart + i] = from[fromStart + i];
  }
}

function nearestColour(colour, candidates, errorDest) {
  var bestCandidate = 0;
  var bestError = Infinity;
  var currentError;
  var channelError = [0, 0, 0];
  var randomCounter = 1;

  for (var i = 0; i < candidates.length; ++i) {
    channelError[0] = degamma(colour[0]) - degamma(candidates[i][0]);
    channelError[1] = degamma(colour[1]) - degamma(candidates[i][1]);
    channelError[2] = degamma(colour[2]) - degamma(candidates[i][2]);
    currentError = channelError.reduce(addSquare, 0);

    // The randomisation here prevents us from always choosing the same colour
    // in cases where there are multiple equally good candidates. This is
    // mainly an issue when the candidates don't have sufficient brightness to
    // reproduce the original image. Randomisation makes for unattractive
    // visual noise, but is better than allowing unbounded diffusion, which
    // would result in the excess brightness 'smearing' diagonally until a
    // dark patch is able to absorb it.
    if (currentError < bestError ||
        (currentError == bestError && Math.random() < 1/++randomCounter)) {
      bestError = currentError;
      bestCandidate = i;
      arrayCopy(channelError, errorDest);
    }
  }

  return candidates[bestCandidate];
}

function bayer(matrix, colours) {
  var matrixSize = matrix.length;
  var currentColour = [0, 0, 0];
  var channelError = [0, 0, 0];

  // Get the source image data, and create a target.
  var canvasWidth = canvas.width;
  var canvasHeight = canvas.height;
  var data = originalData;
  var result = new ImageData(canvasWidth, canvasHeight);
  var bayerOffset;

  for (var i = 0; i < canvasHeight; ++i) {
    for (var j = 0; j < canvasWidth; ++j) {
      arrayCopy(data, i*canvasWidth*4 + j*4, currentColour, 0, 3);
      bayerOffset = matrix[i % matrixSize][j % matrixSize];
      currentColour[0] *= bayerOffset;
      currentColour[1] *= bayerOffset;
      currentColour[2] *= bayerOffset;
      arrayCopy(nearestColour(currentColour, colours, channelError), 0,
                result.data, i*canvasWidth*4 + j*4, 3);
      result.data[i*canvasWidth*4 + j*4 + 3] = 255;
    }
  }
  context.putImageData(result, 0, 0);
}

function thresholding(colours) {
  var currentColour = [0, 0, 0];
  var channelError = [0, 0, 0];

  // Get the source image data, and create a target.
  var canvasWidth = canvas.width;
  var canvasHeight = canvas.height;
  var result = new ImageData(canvasWidth, canvasHeight);
  result.data.set(originalData);

  for (var i = 0; i < canvasHeight; ++i) {
    for (var j = 0; j < canvasWidth; ++j) {
      arrayCopy(result.data, i*canvasWidth*4 + j*4, currentColour, 0, 3);
      arrayCopy(nearestColour(currentColour, colours, channelError), 0,
                result.data, i*canvasWidth*4 + j*4, 3);
    }
  }
  context.putImageData(result, 0, 0);
}

function addWeightedError(colour, error, weight) {
  colour[0] = gamma(degamma(colour[0]) + error[0] * weight);
  colour[1] = gamma(degamma(colour[1]) + error[1] * weight);
  colour[2] = gamma(degamma(colour[2]) + error[2] * weight);
}

function diffuseError(data, i, j, width, error, weight, temp) {
  arrayCopy(data, i*width*4 + j*4, temp, 0, 3);
  addWeightedError(temp, error, weight);
  arrayCopy(temp, 0, data, i*width*4 + j*4, 3);
}

function floydSteinberg(colours) {
  var kernel = [[7/16], [3/16, 5/16, 1/16]];

  var temp = [0, 0, 0];
  var error = [0, 0, 0];

  // Get the source image data, and create a target.
  var width = canvas.width;
  var height = canvas.height;
  var result = new ImageData(width, height);
  result.data.set(originalData);
  var data = result.data;
  var i = 0, j = 0;

  function updateProgress() {
    progressBar.value = i / height * 100;
    if (i < height) {
      setTimeout(updateProgress, 100);
    }
  }

  setTimeout(updateProgress, 0);

  for (i = 0; i < height; ++i) {
    for (j = 0; j < width; ++j) {
      arrayCopy(result.data, i*width*4 + j*4, temp, 0, 3);
      arrayCopy(nearestColour(temp, colours, error), 0,
                result.data, i*width*4 + j*4, 3);

      // Diffuse the error to surrounding pixels.
      // Right neighbour:
      if (j < width-1)
        diffuseError(data, i, j+1, width, error, kernel[0][0], temp);

      if (i < height-1) {
        // Lower left neighbour
        if (j > 0)
          diffuseError(data, i+1, j-1, width, error, kernel[1][0], temp);

        // Lower middle neighbour
        diffuseError(data, i+1, j, width, error, kernel[1][1], temp);

        // Lower right neigbour
        if (j < width-1)
          diffuseError(data, i+1, j+1, width, error, kernel[1][2], temp);
      }
    }
  }
  context.putImageData(result, 0, 0);
}
