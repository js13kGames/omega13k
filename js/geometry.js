$.assign($, {
  CIRCLE_TRIANGLE_X_OFFSETS: Array(CircleConst.COMPONENT_TRIANGLES + 1).fill(0)
    .map((v,i) => Math.cos(i * Math.PI * 2 / CircleConst.COMPONENT_TRIANGLES)),
  CIRCLE_TRIANGLE_Y_OFFSETS: Array(CircleConst.COMPONENT_TRIANGLES + 1).fill(0)
    .map((v,i) => Math.sin(i * Math.PI * 2 / CircleConst.COMPONENT_TRIANGLES)),

  /**
   * Get a random coordinate in a range
   */
  getRandomCoordinate: (r, mx, my) => [$.floor(r() * mx), $.floor(r() * my)],

  makeWebGLReady: (shape) => {
    if (shape[ShapeIndex.RADIUS]) {
      shape[ShapeIndex.WEBGL_REPRESENTATION] = $.getCircleTriangles(shape);
    } else {
      shape[ShapeIndex.WEBGL_REPRESENTATION] = new Float32Array(shape[ShapeIndex.POINTS]);
    }
    shape[ShapeIndex.WEBGL_REPRESENTATION_LENGTH] = shape[ShapeIndex.WEBGL_REPRESENTATION].length / 2;
    return shape;
  },

  /**
   * Get a random circle
   */
  getRandomCircle: (r, mx, my, minr, maxr) => {
    let rad = $.randBetween(r, minr, maxr),
      x = $.randBetween(r, rad, mx-rad),
      y = $.randBetween(r, rad, my-rad),
      col = $.getRandomUsableColor(r)
    return $.makeWebGLReady([col,rad,[x,y]]);
  },

  getRandomRectangle: (r, mx, my, mins, maxs) => {
    let w = $.randBetween(r, mins, maxs),
      h = $.randBetween(r, mins, maxs),
      x = $.randBetween(r, 0, mx-w),
      y = $.randBetween(r, 0, my-h),
      col=$.getRandomUsableColor(r)
    return $.makeWebGLReady([col,,[x,y,x+w,y,x+w,y+h,x,y+h]])
  },

  getRandomIsocelesTriangle: (r, mx, my) => {
    let x1 = $.randBetween(r, 0, mx), y1 = $.randBetween(r, 0, my),
      x2 = r() < 0.5 ? $.randBetween(r, 0, x1) : $.randBetween(r, x1, mx),
      y3 = r() < 0.5 ? $.randBetween(r, 0, y1) : $.randBetween(r, y1, my),
      cv = r(),
      x3 = cv < 0.5 ? (x1 + x2) / 2 : x1,
      y2 = cv >= 0.5 ? (y1 + y3) / 2 : y1;
     return $.makeWebGLReady([$.getRandomUsableColor(r),,[x1, y1, x2, y2, x3, y3]])
  },

  getRandomTriangle: (r, mx, my) => $.makeWebGLReady([
    $.getRandomUsableColor(r),,[
       $.randBetween(r, 0, mx),
       $.randBetween(r, 0, my),
       $.randBetween(r, 0, mx),
       $.randBetween(r, 0, my),
       $.randBetween(r, 0, mx),
       $.randBetween(r, 0, my)
    ]
  ]),

  getRandomShapeString: (r) => {
    let s = ''
    while (1) {
      s += $.getRandomFromArray(r,$.splitString('crit'))
      if (s.length >= 5 || (s.length >= 2 && r() < 0.5)) return s
    }
  },

  getCircleTriangles: (c) => {
    let [x,y] = c[ShapeIndex.POINTS], vertices = [x,y];
    for (let i = 0; i <= CircleConst.COMPONENT_TRIANGLES; i++){
    	vertices.push(x + (c[ShapeIndex.RADIUS] * $.CIRCLE_TRIANGLE_X_OFFSETS[i])),
      vertices.push(y + (c[ShapeIndex.RADIUS] * $.CIRCLE_TRIANGLE_Y_OFFSETS[i]))
    }
    return new Float32Array(vertices);
  },

  getRandomShapes: (r, mx, my, s = '') => {
    let shouldMirror = s.indexOf('m') !== -1;
    let shouldInvert = s.indexOf('v') !== -1;
    s = s.replace(/[mv]/g, '')
    let shapeString = s.length ? s : $.getRandomShapeString(r);
    let shapes = [];
    $.splitString(shapeString).forEach(is => {
      let shape, min=Math.min(mx, my), m5=0.05*min, m30=0.3*min;
      switch(is) {
        case 'c':
          shape = $.getRandomCircle(r, mx, my, m5, m30);
          break;
        case 'r':
          shape = $.getRandomRectangle(r, mx, my, m5, m30);
          break;
        case 'i':
          shape = $.getRandomIsocelesTriangle(r, mx, my, m5, m30);
          break;
        case 't':
          shape = $.getRandomTriangle(r, mx, my, m5, m30);
          break;
      }
      if (shouldInvert) {
          shape[ShapeIndex.POINTS] = $.invertPoints(shape[ShapeIndex.POINTS], mx, 1);
          $.makeWebGLReady(shape);
      }
      shapes.push(shape);
      if (shouldMirror) {
        let newShape = $.setArrayVals(
            [].concat(shape),
            ShapeIndex.POINTS,
            $.invertPoints(shape[ShapeIndex.POINTS], my)
        );
        shapes.push($.makeWebGLReady(newShape));
      }
    });
    return shapes;
  },

  isRectangle: (shape) => shape[ShapeIndex.POINTS].length === 8,
  isTriangle: (shape) => shape[ShapeIndex.POINTS].length === 6,

  isCircle: (shape) => shape[ShapeIndex.POINTS].length === 2,

  getTriangleSign: (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3),

  checkCollision: (shapes, shapesBoundingBox, offsetX, offsetY, projectilePositionX, projectilePositionY, projectileRadius) => {
    if (!$.circleInBoundingBox(projectilePositionX, projectilePositionY, projectileRadius, shapesBoundingBox, offsetX, offsetY)) {
      return false;
    }

    for (let i = 0; i < shapes.length; i++) {
      let shape = shapes[i],
        pts = shape[ShapeIndex.POINTS];
      if (pts && (offsetX !== 0 || offsetY !== 0 )) pts = $.offsetPoints(pts, offsetX, offsetY);

      if ($.isRectangle(shape)) {
        let w = pts[2]-pts[0],
          h = pts[5]-pts[3],
          halfWidth = w/2,
          halfHeight = h/2,
          // calculate distance from the center of the rectangle to the center of the circle
          // along each axis
          xDist = $.abs(
            projectilePositionX - (pts[0] + halfWidth)
          ),
          yDist = $.abs(
            projectilePositionY - (pts[1] + halfHeight)
          )

        // verify that the circle is both within range of the x and y along their
        // respective axis
        if (xDist > (halfWidth + projectileRadius)) continue;
        if (yDist > (halfHeight + projectileRadius)) continue;

        // exit early if close enough to the center along either axis
        if (xDist <= w/2) return true;
        if (yDist <= h/2) return true;

        // calculate the distance from center to center and
        let cornerDist = $.distance([xDist, yDist], [halfWidth, halfHeight]);
        if (cornerDist <= $.pow(projectileRadius,2)) {
          // console.log('Collision. Rectangle corner within circle radius.')
          return true
        }

      } else if ($.isTriangle(shape)) {
        if (!$.circleInBoundingBox(projectilePositionX, projectilePositionY, projectileRadius, $.getBoundingBox(shape), offsetX, offsetY)) {
          continue;
        }

        // vertex is inside circle
        let rSquared = $.pow(projectileRadius,2);
        for (let i = 0; i < pts.length; i+=2) {
          if ($.distance(
              [pts[i], pts[i+1]],
              [projectilePositionX, projectilePositionY]
            ) <= rSquared) {
            // console.log('Collision. Triangle vertex is inside circle.')
            return true;
          }
        }

        // circle center is inside triangle
        let b1 = $.getTriangleSign(projectilePositionX, projectilePositionY, pts[0], pts[1], pts[2], pts[3]),
          b2 = $.getTriangleSign(projectilePositionX, projectilePositionY, pts[2], pts[3], pts[4], pts[5]),
          b3 = $.getTriangleSign(projectilePositionX, projectilePositionY, pts[4], pts[5], pts[0], pts[1]);
        if ((b1 < 0 === b2 < 0) && (b2 < 0 === b3 < 0)) {
          // console.log('Collision. Circle center is inside triangle.')
          return true;
        }

        // circle intersects line
        for (let idx = 0; idx < pts.length; idx+=2) {
          let cx = projectilePositionX - pts[idx + 0];
          let cy = projectilePositionY - pts[idx + 1];
          let ex = pts[(idx + 2) % 6] - pts[idx + 0];
          let ey = pts[(idx + 3) % 6] - pts[idx + 1];

          let k = cx * ex + cy * ey;
          if (k > 0) {
            let distSquared = Math.sqrt($.pow(ex,2) + $.pow(ey,2));
            k /= distSquared;

            if (k < distSquared) {
              if (Math.sqrt($.pow(cx,2) + $.pow(cy,2) - $.pow(k,2)) <= projectileRadius) {
                // console.log('Collision. Circle intersects line.')
                return true;
              }
            }
          }
        }

      } else if ($.isCircle(shape)) {
        // circle to circle
        let dist = $.distance(
          [pts[0], pts[1]],
          [projectilePositionX, projectilePositionY]
        );
        if (dist <= $.pow(shape[ShapeIndex.RADIUS]+ projectileRadius,2)) {
          // console.log('Collision. Circles collide.', JSON.stringify(shape), JSON.stringify(firstShape))
          return true
        }
      }
    }

    return false;
  },

  getContainingBoundingBox: (shapes) => $.mergeBoundingBoxes(shapes.map(shape => $.getBoundingBox(shape))),

  circleInBoundingBox: (x, y, r, box, offsetX=0, offsetY=0) => !((x + r < box[0] + offsetX) // left
      || (x - r > box[0] + offsetX + box[2]) // right
      || (y + r < box[1] + offsetY) // top
      || (y - r > box[1] + offsetY + box[3]) // below
    ),

  mergeBoundingBoxes: (boxes) => {
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    boxes.forEach(box => {
      let [x, y, w, h] = box;
      let right = x + w, bottom = y + h;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    })
    return [minX, minY, maxX-minX, maxY-minY];
  },

  getBoundingBox: (shape) => {
    if (!shape[ShapeIndex.BOUNDING_BOX]) {
        let box, pts = shape[ShapeIndex.POINTS];
        if (shape[ShapeIndex.RADIUS]) {
          box = [
              pts[0]-shape[ShapeIndex.RADIUS],
              pts[1]-shape[ShapeIndex.RADIUS],
              shape[ShapeIndex.RADIUS]*2,
              shape[ShapeIndex.RADIUS]*2
          ];
        } else {
          var rect = [pts[0], pts[1], pts[0], pts[1]];
          pts.forEach((val, idx) => {
            let offset = idx % 2;
            if (val < rect[offset]) rect[offset] = val;
            if (val > rect[2 + offset]) rect[2 + offset] = val;
          });
          rect[2] -= rect[0];
          rect[3] -= rect[1];
          box = rect;
        }
        shape[ShapeIndex.BOUNDING_BOX] = box;
    }
    return shape[ShapeIndex.BOUNDING_BOX];
  },

  checkBoundingBoxesCollide: (box1, box2, offset1 = [0,0], offset2 = [0,0]) => {
    let x1 = offset1[0] + box1[BoundingBoxIndex.POSITION_X],
      y1 = offset1[1] + box1[BoundingBoxIndex.POSITION_Y],
      w1 = box1[BoundingBoxIndex.WIDTH],
      h1 = box1[BoundingBoxIndex.HEIGHT],
      x2 = offset2[0] + box2[BoundingBoxIndex.POSITION_X],
      y2 = offset2[1] + box2[BoundingBoxIndex.POSITION_Y],
      w2 = box2[BoundingBoxIndex.WIDTH],
      h2 = box2[BoundingBoxIndex.HEIGHT];

    return !(x1 > x2 + w2 ||
        x2 > x1 + w1 ||
        y1 > y2 + h2 ||
        y2 > y1 + h1);
  },

  // Get all leftmost points.
  leftOrderedShapes: (shapes) => {
    const leftOrdered = [];
    shapes.forEach(shape => {
      let pts = shape[ShapeIndex.POINTS]

      if (shape[ShapeIndex.RADIUS]) {
        leftOrdered.push(pts)
      } else if (pts.length === 6) {
        let leftIdx = pts.reduce((l, n, idx) => (n < pts[l] && idx % 2 === 0 ? idx : l), 1);
        leftOrdered.push([pts[leftIdx], pts[leftIdx + 1]])
      } else if (pts.length === 8) {
        leftOrdered.push([pts[0], pts[1] + (pts[5] - pts[1]) / 2])
      }
    });
    return leftOrdered.sort((a, b) => {
      return a[0] - b[0]
    });
  },

  getCenterOfShapes: (shapes) => {
    let x = 0, y = 0;

    shapes.forEach(shape => {
      let pts = shape[ShapeIndex.POINTS]
      if (shape[ShapeIndex.RADIUS]) {
        x += pts[0]
        y += pts[1]
      } else if (pts.length === 6) {
        x += (pts[0] + pts[2] + pts[4]) / 3
        y += (pts[1] + pts[3] + pts[5]) / 3
      } else if (pts.length === 8) {
        x += pts[0] + (pts[2] - pts[0]) / 2
        y += pts[1] + (pts[5] - pts[1]) / 2
      }
    });

    return [
      x / shapes.length,
      y / shapes.length
    ];
  }
});
