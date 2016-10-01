onmessage = function(e) {
  ditherFunctions[e.data.ditherType](
      e.data.imageData, palettes[e.data.colourPalette]);
};

var ditherFunctions = {
  'thresholding': function(d, c) { thresholding(d, c); },
  'random': function(d, c) { randomDither(1, d, c); },
  'bayer2x2': function(d, c) { ordered(bayerMatrix2x2, d, c); },
  'bayer4x4': function(d, c) { ordered(bayerMatrix4x4, d, c); },
  'bayer8x8': function(d, c) { ordered(bayerMatrix8x8, d, c); },
  'clusterDot4x4': function(d, c) { ordered(clusterDotMatrix4x4, d, c); },
  'clusterDot8x8': function(d, c) { ordered(clusterDotMatrix8x8, d, c); },
  'verticalStripes': function(d, c) { ordered(verticalStripes, d, c); },
  'horizontalStripes': function(d, c) { ordered(horizontalStripes, d, c); },
  'floydSteinberg': function(d, c) { floydSteinberg(d, c); }
};

var bayerMatrix2x2 = prepareMatrix([
  [1, 3],
  [4, 2]
]);

var bayerMatrix4x4 = prepareMatrix([
  [ 1,  9,  3, 11],
  [13,  5, 15,  7],
  [ 4, 12,  2, 10],
  [16,  8, 14,  6]
]);

var bayerMatrix8x8 = prepareMatrix([
  [ 1, 49, 13, 61,  4, 52, 16, 64],
  [33, 17, 45, 29, 36, 20, 48, 32],
  [ 9, 57,  5, 53, 12, 60,  8, 56],
  [41, 25, 37, 21, 44, 28, 40, 24],
  [ 3, 51, 15, 63,  2, 50, 14, 62],
  [35, 19, 47, 31, 34, 18, 46, 30],
  [11, 59,  7, 55, 10, 58,  6, 54],
  [43, 27, 39, 23, 42, 26, 38, 22]
]);

var clusterDotMatrix4x4 = prepareMatrix([
  [13,  6,  7, 14],
  [ 5,  1,  2,  8],
  [12,  4,  3,  9],
  [16, 11, 10, 15]
]);

var clusterDotMatrix8x8 = prepareMatrix([
  [25, 11, 13, 27, 36, 48, 50, 38],
  [ 9,  1,  3, 15, 46, 60, 62, 52],
  [23,  7,  5, 17, 44, 58, 64, 54],
  [31, 21, 19, 29, 34, 42, 56, 40],
  [35, 47, 49, 37, 26, 12, 14, 28],
  [45, 59, 61, 51, 10,  2,  4, 16],
  [43, 57, 63, 53, 24,  8,  6, 18],
  [33, 41, 55, 39, 32, 22, 20, 30]
]);

var verticalStripes = prepareMatrix([[1, 2, 3, 4, 5, 6, 7, 8]]);

var horizontalStripes = prepareMatrix(
    [[1], [2], [3], [4], [5], [6], [7], [8]]);

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
    [255, 255, 0],
    [255, 255, 255]],
  'mnmColours': [
    [230, 30, 50],
    [255, 80, 10],
    [250, 220, 10],
    [10, 180, 40],
    [0, 110, 230],
    [70, 30, 20]]
};

function prepareMatrix(matrix) {
  var scaleFactor = 1 / (matrix.length * matrix[0].length + 1);
  var result = [];
  for (var i = 0; i < matrix.length; ++i) {
    var row = [];
    for (var j = 0; j < matrix[i].length; ++j) {
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

function add(a, b) {
  return a + b;
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

function colourDistance(target, candidate, errorDest) {
  // Calculate the error per channel, and return the Euclidean colour
  // distance in degamma-ed space.
  errorDest[0] = degamma(candidate[0]) - degamma(target[0]);
  errorDest[1] = degamma(candidate[1]) - degamma(target[1]);
  errorDest[2] = degamma(candidate[2]) - degamma(target[2]);
  return Math.sqrt(errorDest.reduce(addSquare, 0));
}

function nearestColour(colour, candidates, errorDest) {
  var bestCandidate = 0;
  var bestError = Infinity;
  var currentError;
  var channelError = [0, 0, 0];
  var randomCounter = 1;

  for (var i = 0; i < candidates.length; ++i) {
    currentError = colourDistance(candidates[i], colour, channelError);

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

function randomDither(exp, image, colours) {
  var width = image.width;
  var height = image.height;
  var temp = [0, 0, 0];
  var error = [0, 0, 0];
  var r, acc, total;
  var colourOdds = [];

  for (var i = 0; i < height; ++i) {
    for (var j = 0; j < width; ++j) {
      total = 0;
      arrayCopy(image.data, i*width*4 + j*4, temp, 0, 3);
      for (var c = 0; c < colours.length; ++c) {
        colourOdds[c] = 1 / colourDistance(colours[c], temp, error) ** exp;
        total += colourOdds[c];
      }

      // Randomly select a colour based on the probabilities. Since the
      // inverse distances are odds, not probabilities (they don't sum to 1),
      // we need to normalise as we go.
      r = Math.random();
      for (c = acc = 0; c < colourOdds.length && r > acc; ++c) {
        acc += colourOdds[c] / total;
      }
      arrayCopy(colours[c-1], 0, image.data, i*width*4 + j*4, 3);
    }
    postProgressUpdate(i / height * 100);
  }
  postResult(image);
}

function ordered(matrix, image, colours) {
  var width = image.width;
  var height = image.height;
  var matrixHeight = matrix.length;
  var matrixWidth = matrix[0].length;
  var temp = [0, 0, 0];
  var error = [0, 0, 0];
  var bayerOffset;

  for (var i = 0; i < height; ++i) {
    for (var j = 0; j < width; ++j) {
      arrayCopy(image.data, i*width*4 + j*4, temp, 0, 3);
      bayerOffset = matrix[i % matrixHeight][j % matrixWidth];
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
