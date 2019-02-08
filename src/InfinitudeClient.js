const axios = require('axios');
const parser = require('fast-xml-parser');
const _ = require('lodash');

module.exports = class InfinitudeClient {
  static get REFRESH_MS() {
    return 10000;
  }

  constructor(url, log) {
    this.url = url;
    this.log = log;
    this.cachedObjects = {};

    this.xmlOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: ''
    };

    setInterval(
      function() {
        this.refreshAll();
      }.bind(this),
      InfinitudeClient.REFRESH_MS
    );
  }

  refreshAll() {
    this.refreshStatus();
    this.refreshSystems();
  }

  refresh(path, handler) {
    return axios
      .get(`${this.url}${path}`, { timeout: 3000 })
      .then(
        function(response) {
          this.cachedObjects[path] = handler(response);
        }.bind(this)
      )
      .catch(
        function(error) {
          this.log.error(error);
        }.bind(this)
      );
  }

  refreshStatus() {
    return this.refresh(
      '/status.xml',
      response => parser.convertToJson(parser.getTraversalObj(response.data, this.xmlOptions))['status']
    );
  }

  refreshSystems() {
    return this.refresh('/systems.json', response => response.data);
  }

  async getStatus() {
    if (this.cachedObjects['/status.xml'] === undefined) {
      await this.refreshStatus();
    }

    return new Promise(
      function(resolve) {
        resolve(this.cachedObjects['/status.xml']);
      }.bind(this)
    );
  }

  async getSystems() {
    if (this.cachedObjects['/systems.json'] === undefined) {
      await this.refreshSystems();
    }

    return new Promise(
      function(resolve) {
        resolve(this.cachedObjects['/systems.json']);
      }.bind(this)
    );
  }

  async updateSystem(zoneId, handler, callback) {
    if (this.cachedObjects['/systems.json'] === undefined) {
      await this.refreshSystems();
    }

    const configJson = _.cloneDeep(this.cachedObjects['/systems.json']);
    const zone = configJson['system'][0]['config'][0]['zones'][0]['zone'].find(zone => zone['id'] === zoneId);
    handler(zone);
    return axios
      .post(`${this.url}/systems/infinitude`, configJson)
      .then(function(result) {
        if (callback) {
          callback(null);
        }
        return result;
      })
      .catch(
        function(error) {
          this.log.error(error);
          if (callback) {
            callback(error);
          }
          return error.response;
        }.bind(this)
      );
  }

  updateTemperatures(temperatures, zoneId, activityId, callback) {
    return this.updateSystem(
      zoneId,
      zone => {
        const activityConfig = zone['activities'][0]['activity'].find(activity => activity['id'] === activityId);
        for (const property in temperatures) {
          const targetTemperature = temperatures[property];
          activityConfig[property] = [Math.round(targetTemperature).toString() + '.0'];
        }
      },
      callback
    );
  }

  setActivity(zoneId, activity, callback) {
    return this.updateSystem(
      zoneId,
      zone => {
        zone['holdActivity'] = [activity];
      },
      callback
    );
  }
};
