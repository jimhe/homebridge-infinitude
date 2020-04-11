const Joi = require('@hapi/joi');

module.exports = Joi.object()
  .keys({
    platform: Joi.string().required(),
    url: Joi.string().required()
  })
  .unknown();
