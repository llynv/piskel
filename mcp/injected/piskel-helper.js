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
    },

    getPalette: function () {
      var piskel = pc().getPiskel();
      var used = {};
      piskel.getLayers().forEach(function (layer) {
        layer.getFrames().forEach(function (frame) {
          frame.forEachPixel(function (color) {
            if (color !== 0) {
              used[color] = true;
            }
          });
        });
      });
      return Object.keys(used).map(Number);
    },

    setPrimaryColor: function (hex) {
      try {
        var jq = window.$ || window.jQuery;
        if (jq && window.Events && window.Events.SELECT_PRIMARY_COLOR) {
          jq.publish(window.Events.SELECT_PRIMARY_COLOR, [hex]);
          return true;
        }
      } catch (_e) {
        // Convenience only; fall through to false on any failure.
      }
      return false;
    },

    serialize: function () {
      return window.pskl.utils.serialization.Serializer.serialize(
        pc().getPiskel()
      );
    },

    loadFromString: function (data) {
      return new Promise(function (resolve, reject) {
        try {
          var parsed = typeof data === "string" ? JSON.parse(data) : data;
          window.pskl.utils.serialization.Deserializer.deserialize(
            parsed,
            function (piskel) {
              pc().setPiskel(piskel);
              resolve(true);
            },
            function (e) {
              reject(e);
            }
          );
        } catch (e) {
          reject(e);
        }
      });
    },

    // Render one frame (all visible layers merged) to a scaled canvas using
    // the proven off-DOM CanvasRenderer, returning a PNG data URL.
    renderFrameCanvas_: function (frameIndex, scale) {
      var piskel = pc().getPiskel();
      var fi = frameIndex == null ? pc().getCurrentFrameIndex() : frameIndex;
      var merged = window.pskl.utils.LayerUtils.mergeFrameAt(
        piskel.getLayers(),
        fi
      );
      var renderer = new window.pskl.rendering.CanvasRenderer(
        merged,
        scale || 1
      );
      renderer.drawTransparentAs(window.Constants.TRANSPARENT_COLOR);
      return renderer.render();
    },

    exportFramePng: function (scale, frameIndex) {
      return this.renderFrameCanvas_(frameIndex, scale).toDataURL();
    },

    // Composite every frame onto a single grid canvas (in-page) and return a
    // PNG data URL. columns defaults to the frame count (one row).
    exportSpritesheetPng: function (scale, columns) {
      var count = pc().getFrameCount();
      var s = scale || 1;
      var cols = columns || count;
      if (cols < 1) {
        cols = 1;
      }
      var rows = Math.ceil(count / cols);
      var first = this.renderFrameCanvas_(0, s);
      var fw = first.width;
      var fh = first.height;
      var sheet = document.createElement("canvas");
      sheet.width = fw * cols;
      sheet.height = fh * rows;
      var ctx = sheet.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      for (var i = 0; i < count; i++) {
        var canvas = i === 0 ? first : this.renderFrameCanvas_(i, s);
        var px = (i % cols) * fw;
        var py = Math.floor(i / cols) * fh;
        ctx.drawImage(canvas, px, py);
      }
      return sheet.toDataURL();
    },

    // Encode all frames into an animated GIF using Piskel's in-page gif.js
    // encoder. Returns a Promise resolving to a data URL (image/gif).
    exportGif: function (scale, fps) {
      return new Promise(function (resolve, reject) {
        try {
          if (typeof window.GIF !== "function") {
            reject(new Error("window.GIF encoder is not available"));
            return;
          }
          if (!window.GifWorkerURL) {
            reject(new Error("GIF worker URL is not available"));
            return;
          }
          var zoom = scale || 1;
          var rate = fps || pc().getFPS() || 12;
          var piskel = pc().getPiskel();
          var width = piskel.getWidth();
          var height = piskel.getHeight();
          var count = pc().getFrameCount();
          var WHITE = "#ffffff";

          var gif = new window.GIF({
            workers: 2,
            quality: 1,
            width: width * zoom,
            height: height * zoom,
            repeat: 0,
            transparent: null,
            workerScript: window.GifWorkerURL
          });

          // Flatten each frame onto a white background, then scale.
          var background = document.createElement("canvas");
          background.width = width;
          background.height = height;
          var bgCtx = background.getContext("2d");

          for (var i = 0; i < count; i++) {
            var render = pc().renderFrameAt(i, true);
            bgCtx.clearRect(0, 0, width, height);
            bgCtx.fillStyle = WHITE;
            bgCtx.fillRect(0, 0, width, height);
            bgCtx.drawImage(render, 0, 0, width, height);

            var scaled = document.createElement("canvas");
            scaled.width = width * zoom;
            scaled.height = height * zoom;
            var sctx = scaled.getContext("2d");
            sctx.imageSmoothingEnabled = false;
            sctx.drawImage(background, 0, 0, scaled.width, scaled.height);

            gif.addFrame(scaled.getContext("2d"), { delay: 1000 / rate });
          }

          var settled = false;
          var timer = setTimeout(function () {
            if (!settled) {
              settled = true;
              try {
                gif.abort();
              } catch (_e) {
                /* ignore */
              }
              reject(new Error("GIF encoding timed out"));
            }
          }, 60000);

          gif.on("finished", function (blob) {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            var reader = new FileReader();
            reader.onload = function () {
              resolve(reader.result);
            };
            reader.onerror = function () {
              reject(new Error("Failed to read GIF blob"));
            };
            reader.readAsDataURL(blob);
          });
          gif.on("abort", function () {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            reject(new Error("GIF encoding aborted"));
          });

          gif.render();
        } catch (e) {
          reject(e);
        }
      });
    },

    undo: function () {
      window.pskl.app.historyService.undo();
      return true;
    },

    redo: function () {
      window.pskl.app.historyService.redo();
      return true;
    }
  };
})();
