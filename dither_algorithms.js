onmessage = function(e) {
  ditherFunctions[e.data.ditherType](
      e.data.imageData, palettes[e.data.colourPalette]);
};

var ditherFunctions = {
  'thresholding': function(d, c) { thresholding(d, c) },
  'bayer2x2': function(d, c) { bayer(bayerMatrix2x2, d, c); },
  'bayer4x4': function(d, c) { bayer(bayerMatrix4x4, d, c); },
  'bayer8x8': function(d, c) { bayer(bayerMatrix8x8, d, c); },
  'floydSteinberg': function(d, c) { floydSteinberg(d, c); }
};

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

function gamma(n) {
  return Math.pow(n, 0.5);
}

function degamma(n) {
  return Math.pow(n, 2);
}

function addSquare(a, b) {
  return a + b*b;
}

function postResult(image) {
  postMessage({
    type: 'complete',
    imageData: image
  });
}

function postProgressUpdate(n) {
  postMessage({
    type: 'progressUpdate',
    value: n
  });
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

function thresholding(image, colours) {
  var width = image.width;
  var height = image.height;
  var temp = [0, 0, 0];
  var error = [0, 0, 0];

  for (var i = 0; i < height; ++i) {
    for (var j = 0; j < width; ++j) {
      arrayCopy(image.data, i*width*4 + j*4, temp, 0, 3);
      arrayCopy(nearestColour(temp, colours, error), 0,
                image.data, i*width*4 + j*4, 3);
    }
    postProgressUpdate(i / height * 100);
  }
  postResult(image);
}

function bayer(matrix, image, colours) {
  var width = image.width;
  var height = image.height;
  var matrixSize = matrix.length;
  var temp = [0, 0, 0];
  var error = [0, 0, 0];
  var bayerOffset;

  for (var i = 0; i < height; ++i) {
    for (var j = 0; j < width; ++j) {
      arrayCopy(image.data, i*width*4 + j*4, temp, 0, 3);
      bayerOffset = matrix[i % matrixSize][j % matrixSize];
      temp[0] *= bayerOffset;
      temp[1] *= bayerOffset;
      temp[2] *= bayerOffset;
      arrayCopy(nearestColour(temp, colours, error), 0,
                image.data, i*width*4 + j*4, 3);
      image.data[i*width*4 + j*4 + 3] = 255;
    }
    postProgressUpdate(i / height * 100);
  }
  postResult(image);
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

function floydSteinberg(image, colours) {
  var kernel = [[7/16], [3/16, 5/16, 1/16]];

  var width = image.width;
  var height = image.height;
  var temp = [0, 0, 0];
  var error = [0, 0, 0];

  for (var i = 0; i < height; ++i) {
    for (var j = 0; j < width; ++j) {
      arrayCopy(image.data, i*width*4 + j*4, temp, 0, 3);
      arrayCopy(nearestColour(temp, colours, error), 0,
                image.data, i*width*4 + j*4, 3);

      // Diffuse the error to surrounding pixels.
      // Right neighbour:
      if (j < width-1)
        diffuseError(image.data, i, j+1, width, error, kernel[0][0], temp);

      if (i < height-1) {
        // Lower left neighbour
        if (j > 0)
          diffuseError(image.data, i+1, j-1, width, error, kernel[1][0], temp);

        // Lower middle neighbour
        diffuseError(image.data, i+1, j, width, error, kernel[1][1], temp);

        // Lower right neigbour
        if (j < width-1)
          diffuseError(image.data, i+1, j+1, width, error, kernel[1][2], temp);
      }
    }
    postProgressUpdate(i / height * 100);
  }
  postResult(image);
}
