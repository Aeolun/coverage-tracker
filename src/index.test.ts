import request, { Response } from 'supertest'
import { app } from './app'

import * as fs from 'fs'

if (fs.existsSync(__dirname + '/../database.sqlite')) {
  fs.unlinkSync(__dirname + '/../database.sqlite')
}

const server = request(app);

describe('Endpoints', () => {
  it('Loads /', async (done) => {
    const res: Response = await server
      .get('/').send()

    expect(res.status).toEqual(200)
    expect(res.text).toEqual('Ok')

    done()
  })
  it('Posts a test result', async (done) => {
    const res: Response = await server
      .post('/coverage/project/master/jest/save').send({
        'coveredConditionals': 20,
        'coveredStatements': 20,
        'coveredMethods': 20,
        'conditionals': 20,
        'statements': 20,
        'methods': 20,
        'baseBranch': 'master'
      })

    expect(res.status).toEqual(200)
    expect(res.text).toEqual('Saved')

    done()
  })
  it('Retrieves a test result', async (done) => {
    const res: Response = await server
      .get('/coverage/project/master/jest').send()

    expect(res.status).toEqual(200)
    expect(res.body).toMatchObject([{ "baseBranch": "master", "branch": "master", "conditionals": 20, "coveredConditionals": 20, "coveredMethods": 20, "coveredStatements": 20, "id": 1, "methods": 20, "projectName": "project", "statements": 20, "testName": "jest" }])

    done()
  })
  it('It fails to check if there are missing parameters', async (done) => {
    const res: Response = await server
      .get('/coverage/project/feature-test/jest/check').query({
        'coveredConditionals': 18,
        'statements': 12705,
        'methods': 12705,
        'baseBranch': 'master'
      })
    expect(res.status).toEqual(400)
    expect(res.text).toEqual("Missing required parameters: coveredConditionals, coveredStatements, coveredMethods, conditionals, statements, methods, baseBranch")

    done()
  })
  it('It fails to post if there are missing parameters', async (done) => {
    const res: Response = await server
      .post('/coverage/project/feature-test/jest/save').send({
        'coveredConditionals': 18,
        'statements': 12705,
        'methods': 12705,
        'baseBranch': 'master'
      })
    expect(res.status).toEqual(400)
    expect(res.text).toEqual("Missing required parameters: coveredConditionals, coveredStatements, coveredMethods, conditionals, statements, methods, baseBranch")

    done()
  })
  it('Returns a failure if new coverage is lower', async (done) => {
    const res: Response = await server
      .get('/coverage/project/master/jest/check').query({
        'coveredConditionals': 19,
        'coveredStatements': 19,
        'coveredMethods': 19,
        'conditionals': 20,
        'statements': 20,
        'methods': 20,
        'baseBranch': 'master'
      })
    expect(res.status).toEqual(409)
    expect(res.text).toEqual("New coverage (95%) needs to equal or exceed current coverage (100%).")

    done()
  })
  it('Returns weird coverage percentages', async (done) => {
    const res: Response = await server
      .get('/coverage/project/master/jest/check').query({
        'coveredConditionals': 18,
        'coveredStatements': 18,
        'coveredMethods': 18,
        'conditionals': 12705,
        'statements': 12705,
        'methods': 12705,
        'baseBranch': 'master'
      })
    expect(res.status).toEqual(409)
    expect(res.text).toEqual("New coverage (0.14%) needs to equal or exceed current coverage (100%).")

    done()
  })
  it('It checks against base if specified branch does not exist', async (done) => {
    const res: Response = await server
      .get('/coverage/project/feature-test/jest/check').query({
        'coveredConditionals': 18,
        'coveredStatements': 18,
        'coveredMethods': 18,
        'conditionals': 12705,
        'statements': 12705,
        'methods': 12705,
        'baseBranch': 'master'
      })
    expect(res.status).toEqual(409)
    expect(res.text).toEqual("Branch not found, trying base branch master\nNew coverage (0.14%) needs to equal or exceed current coverage (100%).")

    done()
  })
  it('It gets a chart (ish)', async (done) => {
    const res: Response = await server
      .get('/coverage/project/master/jest/chart').send()
    expect(res.status).toEqual(200)
    expect(res.get('content-type')).toEqual("image/png")

    done()
  })
})