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
        'baseBranch': 'master',
        'ref': '183c2d2879cf91589bd965833131b4ef9aee5edd'
      })

    expect(res.status).toEqual(200)
    expect(res.text).toEqual('Saved')

    done()
  })
  it('Retrieves a test result', async (done) => {
    const res: Response = await server
      .get('/coverage/project/master/jest').send()

    expect(res.status).toEqual(200)
    expect(res.body).toMatchObject([{ "baseBranch": "master", "branch": "master", "conditionals": 20, "coveredConditionals": 20, "coveredMethods": 20, "coveredStatements": 20, "id": 1, "methods": 20, "projectName": "project", "statements": 20, "testName": "jest", "ref": "183c2d2879cf91589bd965833131b4ef9aee5edd" }])

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
    expect(res.text).toEqual("Missing required parameters: coveredConditionals, coveredStatements, coveredMethods, conditionals, statements, methods, baseBranch, ref")

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
  it('It gets a badge', async (done) => {
    const res: Response = await server
      .get('/coverage/project/master/jest/badge').send()
    expect(res.status).toEqual(200)
    expect(res.get('content-type')).toEqual("image/svg+xml; charset=utf-8")
    expect(res.body.toString()).toEqual('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="62" height="20"><linearGradient id="b" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="a"><rect width="62" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#a)"><path fill="#555" d="M0 0h31v20H0z"/><path fill="#97ca00" d="M31 0h31v20H31z"/><path fill="url(#b)" d="M0 0h62v20H0z"/></g><g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110"> <text x="165" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="210">jest</text><text x="165" y="140" transform="scale(.1)" textLength="210">jest</text><text x="455" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="210">100</text><text x="455" y="140" transform="scale(.1)" textLength="210">100</text></g> </svg>')

    done()
  })
})