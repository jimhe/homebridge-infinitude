const Joi = require('joi');

module.exports = Joi.object()
  .keys({
    platform: Joi.string().required(),
    url: Joi.string().required()
  })
  .unknown();
