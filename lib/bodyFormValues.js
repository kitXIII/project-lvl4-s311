import _ from 'lodash';

export default (allowedFields, ctx) => {
  const { form: rawData } = ctx.request.body;
  const data = _.pickBy(_.pick(rawData, allowedFields), str => str);
  return data;
};