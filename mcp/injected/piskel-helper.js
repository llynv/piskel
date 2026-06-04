(function () {
  function pc() {
    return window.pskl.app.piskelController;
  }

  function $pub() {
    var jq = window.$ || window.jQuery;
    jq.publish(window.Events.PISKEL_SAVE_STATE, {
      type: window.pskl.service.HistoryService.SNAPSHOT
    });
  }

  function toInt(color) {
    return window.pskl.utils.colorToInt(color);
  }

  window.__piskelMcp = {
    applyPixels: function (pixels) {
      var frame = pc().getCurrentFrame();
      for (var i = 0; i < pixels.length; i++) {
        var p = pixels[i];
        frame.setPixel(p.x, p.y, toInt(p.color));
      }
      $pub();
      return true;
    },

    floodFill: function (x, y, color) {
      var frame = pc().getCurrentFrame();
      var w = frame.getWidth(),
        h = frame.getHeight();
      if (x < 0 || y < 0 || x >= w || y >= h) {
        return false;
      }
      var target = frame.getPixel(x, y);
      var replacement = toInt(color);
      if (target === replacement) {
        return true;
      }
      var stack = [[x, y]];
      while (stack.length) {
        var c = stack.pop();
        var cx = c[0],
          cy = c[1];
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) {
          continue;
        }
        if (frame.getPixel(cx, cy) !== target) {
          continue;
        }
        frame.setPixel(cx, cy, replacement);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      $pub();
      return true;
    },

    clearArea: function (area) {
      var frame = pc().getCurrentFrame();
      if (!area) {
        frame.clear();
      } else {
        var t = toInt(window.Constants.TRANSPARENT_COLOR);
        for (var j = 0; j < area.h; j++) {
          for (var i = 0; i < area.w; i++) {
            frame.setPixel(area.x + i, area.y + j, t);
          }
        }
      }
      $pub();
      return true;
    },

    canvasInfo: function () {
      var piskel = pc().getPiskel();
      var layers = piskel.getLayers().map(function (l) {
        return { name: l.getName(), opacity: l.getOpacity() };
      });
      return {
        width: piskel.getWidth(),
        height: piskel.getHeight(),
        fps: pc().getFPS(),
        name: piskel.getDescriptor().name,
        layerCount: piskel.getLayers().length,
        frameCount: pc().getFrameCount(),
        currentLayer: pc().getCurrentLayerIndex(),
        currentFrame: pc().getCurrentFrameIndex(),
        layers: layers
      };
    },

    getPixelHex: function (x, y, layerIndex, frameIndex) {
      var piskel = pc().getPiskel();
      var li = layerIndex == null ? pc().getCurrentLayerIndex() : layerIndex;
      var fi = frameIndex == null ? pc().getCurrentFrameIndex() : frameIndex;
      var frame = piskel.getLayerAt(li).getFrameAt(fi);
      return frame.getPixel(x, y);
    },

    previewDataUrl: function (scale, layerIndex, frameIndex) {
      var piskel = pc().getPiskel();
      var li = layerIndex == null ? pc().getCurrentLayerIndex() : layerIndex;
      var fi = frameIndex == null ? pc().getCurrentFrameIndex() : frameIndex;
      var frame = piskel.getLayerAt(li).getFrameAt(fi);
      var renderer = new window.pskl.rendering.CanvasRenderer(
        frame,
        scale || 1
      );
      renderer.drawTransparentAs(window.Constants.TRANSPARENT_COLOR);
      return renderer.render().toDataURL();
    }
  };
})();
