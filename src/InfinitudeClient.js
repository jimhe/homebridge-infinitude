const axios = require('axios');
const parser = require('fast-xml-parser');

class InfinitudeCachedObject {
  constructor(object, time) {
    this.object = object;
    this.time = time;
  }
}

module.exports = class InfinitudeClient {
  constructor(url, log) {
    this.url = url;
    this.log = log;
    this.cachedObjects = {};

    this.xmlOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: ''
    };
  }

  clearCache() {
    this.cachedObjects = {};
  }

  get(path, ttlMs, handler) {
    const now = new Date().getTime();

    let cachedObj = this.cachedObjects[path];
    if (cachedObj !== undefined) {
      const diff = now - cachedObj.time;
      if (diff <= ttlMs) {
        return new Promise(function(resolve) {
          resolve(cachedObj.object);
        });
      }
    }
    return axios
      .get(`${this.url}${path}`, { timeout: 1000 })
      .then(
        function(response) {
          const cachedObj = new InfinitudeCachedObject(handler(response), new Date().getTime());
          this.cachedObjects[path] = cachedObj;
          return cachedObj.object;
        }.bind(this)
      )
      .catch(
        function(error) {
          this.log.error(error);
        }.bind(this)
      );
  }

  getStatus(ttlMs = 1000) {
    return this.get(
      '/status.xml',
      ttlMs,
      response => parser.convertToJson(parser.getTraversalObj(response.data, this.xmlOptions))['status']
    );
  }

  getSystems(ttlMs = 1000) {
    return this.get('/systems.json', ttlMs, response => response.data);
  }

  async updateSystem(zoneId, handler, callback) {
    return this.getSystems(30000)
      .then(
        function(configJson) {
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
        }.bind(this)
      )
      .catch(function(error) {
        callback(error);
      });
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
