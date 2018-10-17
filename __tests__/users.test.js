import request from 'supertest';
import matchers from 'jest-supertest-matchers';
import faker from 'faker';

import app from '..';
import db from '../models';
import encrypt from '../lib/secure';

import getFakeUser from './lib/fakerUser';

const { sequelize, User } = db;

beforeAll(async () => {
  await sequelize.sync({ force: 'true' });
  jasmine.addMatchers(matchers);
});

describe('Users requests', () => {
  let server;
  const user = getFakeUser();

  beforeEach(() => {
    server = app().listen();
  });

  it('GET /users', async () => {
    const res = await request.agent(server)
      .get('/users');
    expect(res).toHaveHTTPStatus(200);
  });

  it('GET /users/new', async () => {
    const res = await request.agent(server)
      .get('/users/new');
    expect(res).toHaveHTTPStatus(200);
  });

  it('POST /users', async () => {
    const someUser = getFakeUser();
    const res = await request.agent(server)
      .post('/users')
      .send({ form: someUser });
    expect(res).toHaveHTTPStatus(302);
    const url = res.headers.location;
    expect(url).toBe('/');

    const userFromDB = await User.findOne({
      where: {
        email: someUser.email,
      },
    });
    expect(userFromDB).toBeDefined();
  });

  it('GET /users/:id', async () => {
    const someUser = getFakeUser();
    const userFromDB = await User.create(someUser);

    const getRes = await request.agent(server)
      .get(`/users/${userFromDB.id}`);
    expect(getRes).toHaveHTTPStatus(200);
  });

  it('POST /users (email duplicate)', async () => {
    const someUser = getFakeUser();
    await User.create(someUser);

    const res = await request.agent(server)
      .post('/users')
      .send({ form: someUser });
    expect(res).toHaveHTTPStatus(422);
  });

  it('POST /users (email error)', async () => {
    const res = await request.agent(server)
      .post('/users')
      .send({ form: { ...user, email: 'not email' } });
    expect(res).toHaveHTTPStatus(422);
  });

  it('POST /users (firsName error)', async () => {
    const res = await request.agent(server)
      .post('/users')
      .send({ form: { ...user, firstName: '' } });
    expect(res).toHaveHTTPStatus(422);
  });

  it('POST /users (password error)', async () => {
    const res = await request.agent(server)
      .post('/users')
      .send({ form: { ...user, password: '12345', confirmPassword: '12345' } });
    expect(res).toHaveHTTPStatus(422);
  });

  it('POST /users (confirm password error)', async () => {
    const res = await request.agent(server)
      .post('/users')
      .send({ form: { ...user, confirmPassword: faker.internet.password() } });
    expect(res).toHaveHTTPStatus(422);
  });

  afterEach((done) => {
    server.close();
    done();
  });
});

describe('Users get edit form page', () => {
  let server;
  let user;
  let userFromDB;

  beforeAll(async () => {
    user = getFakeUser();
    userFromDB = await User.create(user);
  });

  beforeEach(() => {
    server = app().listen();
  });

  it('GET /users/:id/edit', async () => {
    const { email, password } = user;
    const postRes = await request.agent(server)
      .post('/sessions')
      .send({ form: { email, password } });
    const cookie = postRes.headers['set-cookie'];

    const getRes = await request.agent(server)
      .set('Cookie', cookie)
      .get(`/users/${userFromDB.id}/edit`);
    expect(getRes).toHaveHTTPStatus(200);
  });

  it('GET /users/:id/edit (fail without autority)', async () => {
    const res = await request.agent(server)
      .get(`/users/${userFromDB.id}/edit`);
    expect(res).toHaveHTTPStatus(401);

    const url = res.headers.location;
    const res2 = await request.agent(server)
      .get(url);
    expect(res2).toHaveHTTPStatus(200);
  });

  it('GET /users/:id/edit (fail with autority, another user)', async () => {
    const someUser = getFakeUser();
    const { email, password } = someUser;
    await User.create(someUser);
    const postRes = await request.agent(server)
      .post('/sessions')
      .send({ form: { email, password } });
    const cookie = postRes.headers['set-cookie'];

    const getRes = await request.agent(server)
      .set('Cookie', cookie)
      .get(`/users/${userFromDB.id}/edit`);
    expect(getRes).toHaveHTTPStatus(401);

    const url = getRes.headers.location;
    const res = await request.agent(server)
      .get(url);
    expect(res).toHaveHTTPStatus(200);
  });

  afterEach((done) => {
    server.close();
    done();
  });
});

describe('Users updade requests', () => {
  let server;
  let user;
  let userFromDB;
  let cookie;

  beforeEach(async () => {
    server = app().listen();
    user = getFakeUser();
    userFromDB = await User.create(user);
    const { email, password } = user;
    const res = await request.agent(server)
      .post('/sessions')
      .send({ form: { email, password } });
    cookie = res.headers['set-cookie'];
  });

  it('PATCH /users/:id (firstName, lastName)', async () => {
    const { firstName, lastName } = getFakeUser();

    const res = await request.agent(server)
      .set('Cookie', cookie)
      .patch(`/users/${userFromDB.id}`)
      .send({ form: { firstName, lastName } });
    expect(res).toHaveHTTPStatus(200);

    const patchedUserFromDB = await User.findOne({
      where: {
        email: user.email,
      },
    });

    expect(patchedUserFromDB.firstName).toBe(firstName);
    expect(patchedUserFromDB.lastName).toBe(lastName);
  });

  it('PATCH /users/:id (email)', async () => {
    const { email } = getFakeUser();

    const res = await request.agent(server)
      .set('Cookie', cookie)
      .patch(`/users/${userFromDB.id}`)
      .send({ form: { email } });
    expect(res).toHaveHTTPStatus(200);
    const recivedCookie = res.headers['set-cookie'];

    const patchedUserFromDB = await User.findOne({
      where: {
        id: userFromDB.id,
      },
    });

    expect(patchedUserFromDB.email).toBe(email);
    expect(cookie).not.toBe(recivedCookie);
  });

  it('PATCH /users/:id (password)', async () => {
    const password = 'ZxCv23Bn';
    const confirmPassword = 'ZxCv23Bn';

    const res = await request.agent(server)
      .patch(`/users/${userFromDB.id}`)
      .set('Cookie', cookie)
      .send({ form: { password, confirmPassword } });
    expect(res).toHaveHTTPStatus(200);
    const recivedCookie = res.headers['set-cookie'];

    const patchedUserFromDB = await User.findOne({
      where: {
        id: userFromDB.id,
      },
    });

    expect(patchedUserFromDB.passwordDigest).toBe(encrypt(password));
    expect(cookie).not.toBe(recivedCookie);
  });

  it('PATCH /users/:id (fail without autority)', async () => {
    const { firstName } = getFakeUser();
    const delSessionRes = await request.agent(server)
      .set('Cookie', cookie)
      .delete('/sessions');
    expect(delSessionRes).toHaveHTTPStatus(302);

    const res = await request.agent(server)
      .patch(`/users/${userFromDB.id}`)
      .send({ form: { firstName } });
    expect(res).toHaveHTTPStatus(401);
  });

  it('PATCH /users/:id/edit (fail with autority, another user)', async () => {
    const newUserFromDB = await User.create(getFakeUser());
    const { firstName } = getFakeUser();
    const res = await request.agent(server)
      .patch(`/users/${newUserFromDB.id}`)
      .set('Cookie', cookie)
      .send({ form: { firstName } });
    expect(res).toHaveHTTPStatus(401);
  });

  afterEach((done) => {
    server.close();
    done();
  });
});

describe('Users delete requests', () => {
  let server;

  beforeEach(async () => {
    server = app().listen();
  });

  it('DELETE /users/:id', async () => {
    const user = getFakeUser();
    const userFromDB = await User.create(user);
    const { email, password } = user;
    const res = await request.agent(server)
      .post('/sessions')
      .send({ form: { email, password } });
    expect(res).toHaveHTTPStatus(302);
    const cookie = res.headers['set-cookie'];

    const delRes = await request.agent(server)
      .set('Cookie', cookie)
      .delete(`/users/${userFromDB.id}`);
    expect(delRes).toHaveHTTPStatus(200);
  });

  it('DELETE /users/:id (fail without autority)', async () => {
    const userFromDB = await User.create(getFakeUser());
    const res = await request.agent(server)
      .delete(`/users/${userFromDB.id}`);
    expect(res).toHaveHTTPStatus(401);
  });

  it('DELETE /users/:id/edit (fail with autority, another user)', async () => {
    const user = getFakeUser();
    await User.create(user);
    const { email, password } = user;
    const res = await request.agent(server)
      .post('/sessions')
      .send({ form: { email, password } });
    expect(res).toHaveHTTPStatus(302);
    const cookie = res.headers['set-cookie'];

    const newUserFromDB = await User.create(getFakeUser());
    const delRes = await request.agent(server)
      .set('Cookie', cookie)
      .delete(`/users/${newUserFromDB.id}`);
    expect(delRes).toHaveHTTPStatus(401);
  });

  afterEach((done) => {
    server.close();
    done();
  });
});