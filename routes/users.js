import buildFormObj from '../lib/formObjectBuilder';
import { User } from '../models';

export default (router, { logger }) => {
  router
    .get('users', '/users', async (ctx) => {
      logger('Users: try to get users list');
      const users = await User.findAll();
      logger('Users: users list success');
      ctx.render('users', { users });
    })
    .get('newUser', '/users/new', (ctx) => {
      logger('Users: prepare data for new user form');
      const user = User.build();
      ctx.render('users/new', { f: buildFormObj(user) });
    })
    .post('users', '/users', async (ctx) => {
      const { form } = ctx.request.body;
      logger('Users: got new user data');
      const user = User.build(form);
      try {
        logger('Users: try to create new user (save to database)');
        await user.save();
        logger('New user has been created');
        ctx.flash.set('User has been created');
        ctx.redirect(router.url('root'));
      } catch (e) {
        ctx.render('users/new', { f: buildFormObj(user, e) });
      }
    });
};