const Joi = require('@hapi/joi');

module.exports = Joi.object()
  .keys({
    platform: Joi.string().required(),
    url: Joi.string().required(),
    holdUntil: Joi.string().pattern(new RegExp('^([0-1][0-9]|2[0-3]):[0-5][0-9]$')),
    shutOffAway: Joi.boolean(),
    holdUntilNextActivity: Joi.boolean()
  })
  .unknown();
