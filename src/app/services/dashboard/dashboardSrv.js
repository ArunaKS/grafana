define([
  'angular',
  'jquery',
  'kbn',
  'lodash',
  '../timer',
],
function (angular, $, kbn, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('dashboardSrv', function(timer, $rootScope, $timeout, $location) {

    function DashboardModel (data) {

      if (!data) {
        data = {};
      }

      this.title = data.title || 'No Title';
      this.tags = data.tags || [];
      this.style = data.style || "dark";
      this.timezone = data.timezone || 'browser';
      this.editable = data.editble || true;
      this.rows = data.rows || [];
      this.pulldowns = data.pulldowns || [];
      this.nav = data.nav || [];
      this.time = data.time || { from: 'now-6h', to: 'now' };
      this.templating = data.templating || { list: [] };
      this.refresh = data.refresh;
      this.version = data.version || 0;
      this.$state = data.$state;

      if (this.nav.length === 0) {
        this.nav.push({ type: 'timepicker' });
      }

      if (!_.findWhere(this.pulldowns, {type: 'filtering'})) {
        this.pulldowns.push({ type: 'filtering', enable: false });
      }

      if (!_.findWhere(this.pulldowns, {type: 'annotations'})) {
        this.pulldowns.push({ type: 'annotations', enable: false });
      }

      this.updateSchema(data);
    }

    var p = DashboardModel.prototype;

    p.emit_refresh = function() {
      $rootScope.$broadcast('refresh');
    };

    p.start_scheduled_refresh = function (after_ms) {
      this.cancel_scheduled_refresh();
      this.refresh_timer = timer.register($timeout(function () {
        this.start_scheduled_refresh(after_ms);
        this.emit_refresh();
      }.bind(this), after_ms));
    };

    p.cancel_scheduled_refresh = function () {
      timer.cancel(this.refresh_timer);
    };

    p.set_interval = function (interval) {
      this.refresh = interval;
      if (interval) {
        var _i = kbn.interval_to_ms(interval);
        this.start_scheduled_refresh(_i);
      } else {
        this.cancel_scheduled_refresh();
      }
    };

    p.updateSchema = function(old) {
      var i, j, row, panel;
      var oldVersion = this.version;
      this.version = 3;

      if (oldVersion === 3) {
        return;
      }

      // Version 3 schema changes
      // ensure panel ids
      var panelId = 1;
      for (i = 0; i < this.rows.length; i++) {
        row = this.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          panel.id = panelId;
          panelId += 1;
        }
      }

      if (oldVersion === 2) {
        return;
      }

      // Version 2 schema changes
      if (old.services) {
        if (old.services.filter) {
          this.time = old.services.filter.time;
          this.templating.list = old.services.filter.list;
        }
        delete this.services;
      }

      for (i = 0; i < this.rows.length; i++) {
        row = this.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.type === 'graphite') {
            panel.type = 'graph';
          }

          if (panel.type === 'graph') {
            if (_.isBoolean(panel.legend)) {
              panel.legend = { show: panel.legend };
            }

            if (panel.grid) {
              if (panel.grid.min) {
                panel.grid.leftMin = panel.grid.min;
                delete panel.grid.min;
              }

              if (panel.grid.max) {
                panel.grid.leftMax = panel.grid.max;
                delete panel.grid.max;
              }
            }

            if (panel.y_format) {
              panel.y_formats[0] = panel.y_format;
              delete panel.y_format;
            }

            if (panel.y2_format) {
              panel.y_formats[1] = panel.y2_format;
              delete panel.y2_format;
            }
          }
        }
      }

      this.version = 3;
    };

    // represents the transient view state
    // like fullscreen panel & edit
    function DashboardViewState() {
      var queryParams = $location.search();
      this.update({
        panelId: parseInt(queryParams.panelId),
        fullscreen: queryParams.fullscreen ? true : false,
        edit: queryParams.edit ? true : false
      });
    }

    DashboardViewState.prototype.update = function(state) {
      _.extend(this, state);
      if (!this.fullscreen) {
        delete this.fullscreen;
        delete this.panelId;
        delete this.edit;
      }
      if (!this.edit) { delete this.edit; }

      $location.search(this);
    };

    return {
      create: function(dashboard) {
        return new DashboardModel(dashboard);
      },
      createViewState: function(state) {
        return new DashboardViewState(state);
      }
    };

  });
});
