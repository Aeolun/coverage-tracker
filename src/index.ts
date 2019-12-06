import "reflect-metadata";
import { createConnection } from "typeorm";
import * as express from "express"
import { Coverage } from './entity/Coverage'
import { json } from 'express'
import * as morgan from 'morgan'
import { ParamsDictionary } from 'express-serve-static-core'

interface ProjectParams extends ParamsDictionary {projectName: string, testName: string}

const requiredProperties = [
  'coveredConditionals',
  'coveredStatements',
  'coveredMethods',
  'conditionals',
  'statements',
  'methods'
]

const hasRequiredParams = (obj): boolean => {
  requiredProperties.forEach(prop => {
    if (!obj[prop] && obj[prop] !== 0) {
      return false
    }
  })
  return true
}

createConnection().then(async connection => {
  const app = express();
  app.use(json())
  app.use(morgan())
  app.get('/', (req, res) => {
    res.send('Ok')
  })
  app.get<ProjectParams>('/coverage/:projectName/:testName/check', async (req, res) => {
    if (hasRequiredParams(req.query)) {
      const currentCoverage = await connection.manager.findOne(Coverage, {
        where: {
          projectName: req.params.projectName,
          testName: req.params.testName
        }
      });
      if (!currentCoverage) {
        res.status(200).send()
      } else {
        if (req.query.coveredStatements + req.query.coveredConditionals + req.query.coveredMethods >= currentCoverage.getTotalCoverage()) {
          res.status(409).send("New coverage needs to equal or exceed current coverage.")
        }
      }
    } else {
      res.status(400).send("Missing required parameters: "+requiredProperties.join(', '))
    }
  })
  app.get<ProjectParams>('/coverage/:projectName/:testName', async (req, res) => {
    const coverage = await connection.manager.find(Coverage, {
      where: {
        projectName: req.params.projectName,
        testName: req.params.testName
      }
    });
    if (!coverage) {
      res.status(200).json(coverage)
    } else {
      res.status(404).send("Project and/or test does not exist.")
    }
  })
  app.post<ProjectParams>('/coverage/:projectName/:testName/save', (req, res) => {
    if (hasRequiredParams(req.query)) {
      const newCoverage = new Coverage()
      newCoverage.projectName = req.params.projectName
      newCoverage.testName = req.params.testName

      requiredProperties.forEach(property => {
        newCoverage[property] = req.body[property]
      })

      connection.manager.save(newCoverage).then(result => {
        res.send(200).send('Saved')
      }).catch(error => {
        res.status(500).send(error.message)
      })
    } else {
      res.status(400).send("Missing required parameters: "+requiredProperties.join(', '))
    }
  })

  app.listen(3000, () => console.log('App started on port 3000'))
}).catch(error => console.log(error));
