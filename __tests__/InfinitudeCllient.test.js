const nock = require('nock');
const InfinitudeClient = require('../src/InfinitudeClient');
const MockDate = require('mockdate');
const _ = require('lodash');

global.console = { error: jest.fn() };

describe('InfinitudeClient', () => {
  const url = 'http://localhost';
  const client = new InfinitudeClient(url, console);

  afterEach(() => {
    client.clearCache();
  });

  test('Status caches as expected', async () => {
    const scope = nock(url)
      .get('/status.xml')
      .times(2)
      .replyWithFile(200, '__tests__/resources/status.xml', {
        'Content-Type': 'application/xml'
      });
    MockDate.set('2018-01-07 00:01:00:00');
    const status = await client.getStatus();
    MockDate.set('2018-01-07 00:01:00:01');
    await client.getStatus();
    MockDate.set('2018-01-07 00:01:01:01');
    await client.getStatus();

    expect(status['cfgem']).toBe('F');
    expect(scope.isDone()).toBe(true);
  });

  test('Systems caches as expected', async () => {
    const scope = nock(url)
      .get('/systems.json')
      .times(2)
      .replyWithFile(200, '__tests__/resources/systems.json', 'UTF-8', {
        'Content-Type': 'application/json'
      });

    MockDate.set('2018-01-07 00:01:00:00');
    const systems = await client.getSystems();
    MockDate.set('2018-01-07 00:01:00:01');
    await client.getSystems();
    MockDate.set('2018-01-07 00:01:01:01');
    await client.getSystems();

    expect(systems['system'][0]['version']).toBe('1.7');
    expect(scope.isDone()).toBe(true);
  });

  test('Status handles errors', async () => {
    const scope = nock(url)
      .get('/status.xml')
      .reply(500)
      .get('/status.xml')
      .reply(404);

    const status = await client.getStatus();
    await client.getStatus();

    expect(status).toBe(undefined);
    expect(scope.isDone()).toBe(true);
  });

  test('Systems handles timeouts', async () => {
    const scope = nock(url)
      .get('/systems.json')
      .delayConnection(2000)
      .replyWithFile(200, '__tests__/resources/systems.json', 'UTF-8', {
        'Content-Type': 'application/json'
      });

    const systems = await client.getSystems();
    expect(systems).toBe(undefined);
    expect(scope.isDone()).toBe(true);
  });

  test('Updates temperatures', async () => {
    const scope = nock(url)
      .get('/systems.json')
      .times(2)
      .replyWithFile(200, '__tests__/resources/systems.json', 'UTF-8', {
        'Content-Type': 'application/json'
      })
      .post(
        '/systems/infinitude',
        _.matches({
          system: [
            {
              config: [
                {
                  zones: [
                    {
                      zone: [
                        {
                          id: '1',
                          activities: [
                            {
                              activity: [
                                {
                                  id: 'home',
                                  clsp: ['25.0'],
                                  htsp: ['100.0']
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        })
      )
      .times(3)
      .reply(200);

    const temperatures = {
      htsp: 100,
      clsp: 25
    };

    // Issues GET + POST
    MockDate.set('2018-01-07 00:01:00:00');
    await client.updateTemperatures(temperatures, '1', 'home', () => {});
    // Before 30s TTL, issues only POST
    MockDate.set('2018-01-07 00:01:05:00');
    await client.updateTemperatures(temperatures, '1', 'home', () => {});
    // After 30s TTL, issues GET + POST
    MockDate.set('2018-01-07 00:01:31:00');
    await client.updateTemperatures(temperatures, '1', 'home', () => {});

    expect(scope.isDone()).toBe(true);
  });

  test('Updates activity', async () => {
    const scope = nock(url)
      .get('/systems.json')
      .times(2)
      .replyWithFile(200, '__tests__/resources/systems.json', 'UTF-8', {
        'Content-Type': 'application/json'
      })
      .post(
        '/systems/infinitude',
        _.matches({
          system: [
            {
              config: [
                {
                  zones: [
                    {
                      zone: [
                        {
                          id: '1',
                          holdActivity: ['home']
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        })
      )
      .times(3)
      .reply(200);

    // Issues GET + POST
    MockDate.set('2018-01-07 00:01:00:00');
    const result = await client.setActivity('1', 'home', () => {});
    // Before 30s TTL, issues only POST
    MockDate.set('2018-01-07 00:01:05:00');
    await client.setActivity('1', 'home', () => {});
    // After 30s TTL, issues GET + POST
    MockDate.set('2018-01-07 00:01:31:00');
    await client.setActivity('1', 'home', () => {});

    expect(result.status).toBe(200);
    expect(scope.isDone()).toBe(true);
  });

  test('Handles update activity failures', async () => {
    const scope = nock(url)
      .get('/systems.json')
      .replyWithFile(200, '__tests__/resources/systems.json', 'UTF-8', {
        'Content-Type': 'application/json'
      })
      .get('/systems.json')
      .reply(500)
      .post(
        '/systems/infinitude',
        _.matches({
          system: [
            {
              config: [
                {
                  zones: [
                    {
                      zone: [
                        {
                          id: '1',
                          holdActivity: ['home']
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        })
      )
      .times(2)
      .reply(500);

    // Issues GET + POST
    MockDate.set('2018-01-07 00:01:00:00');
    const result = await client.setActivity('1', 'home', () => {});
    // Before 30s TTL, issues only POST
    MockDate.set('2018-01-07 00:01:05:00');
    await client.setActivity('1', 'home', () => {});
    // After 30s TTL, issues GET, but does not POST since GET returns 500
    MockDate.set('2018-01-07 00:01:31:00');
    await client.setActivity('1', 'home', () => {});

    expect(result.status).toBe(500);
    expect(scope.isDone()).toBe(true);
  });
});
