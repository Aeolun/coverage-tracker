import "reflect-metadata";
import { createConnection, LessThan, Connection } from "typeorm";
import express from "express"
import { View, parse } from 'vega'
import { Canvas } from 'canvas'
import { Coverage } from './entity/Coverage'
import { json } from 'express'
import morgan from 'morgan'
import { ParamsDictionary } from 'express-serve-static-core'

interface ProjectParams extends ParamsDictionary {
  projectName: string
  branch: string
  testName: string
}

const requiredProperties = [
  'coveredConditionals',
  'coveredStatements',
  'coveredMethods',
  'conditionals',
  'statements',
  'methods',
  'baseBranch'
]

const hasRequiredParams = (obj): boolean => {
  let result = true
  console.log(obj)
  requiredProperties.forEach(prop => {
    if (!obj[prop]) {
      result = false
    }
  })
  return result
}

export const app = express();
let connection: Connection;

app.use((req, res, next) => {
  if (!connection || !connection.isConnected) {
    createConnection().then(async newConnection => {
      console.log('connected')
      connection = newConnection
      next()
    }).catch(error => {
      console.log(error)
      res.status(500).send('Could not connect to database')
    });
  } else {
    next()
  }
})
app.use(morgan(process.env.NODE_ENV == 'dev' ? 'dev' : 'combined'))
app.use(json())

app.get('/', (req, res) => {
  res.status(200).send('Ok')
})
app.get<ProjectParams>('/coverage/:projectName/:branch/:testName/check', async (req, res) => {
  if (hasRequiredParams(req.query)) {
    const newCoveragePercent = Math.round((parseInt(req.query.coveredStatements) + parseInt(req.query.coveredConditionals) + parseInt(req.query.coveredMethods)) / (parseInt(req.query.statements) + parseInt(req.query.conditionals) + parseInt(req.query.methods)) * 10000) / 100
    let currentCoverage
    let extra: string = ""
    currentCoverage = await connection.manager.findOne(Coverage, {
      where: {
        projectName: req.params.projectName,
        branch: req.params.branch,
        testName: req.params.testName
      },
      order: {
        createdDate: 'DESC'
      }
    });
    if (!currentCoverage && req.query.baseBranch != req.params.branch) {
      extra = `Branch not found, trying base branch ${req.query.baseBranch}\n`
      currentCoverage = await connection.manager.findOne(Coverage, {
        where: {
          projectName: req.params.projectName,
          branch: req.query.baseBranch,
          testName: req.params.testName
        },
        order: {
          createdDate: 'DESC'
        }
      });
    }
    if (!currentCoverage) {
      res.status(200).send(extra + newCoveragePercent + "% >= 0")
    } else {
      if (newCoveragePercent >= currentCoverage.getCoveragePercent()) {
        res.status(200).send(extra + newCoveragePercent + "% >= " + currentCoverage.getCoveragePercent() + "%")
      } else {
        res.status(409).send(extra + "New coverage (" + newCoveragePercent + "%) needs to equal or exceed current coverage (" + currentCoverage.getCoveragePercent() + "%).")
      }
    }
  } else {
    res.status(400).send("Missing required parameters: " + requiredProperties.join(', '))
  }
})
app.get<ProjectParams>('/coverage/:projectName/:branch/:testName', async (req, res) => {
  const coverage = await connection.manager.find(Coverage, {
    where: {
      projectName: req.params.projectName,
      branch: req.params.branch,
      testName: req.params.testName
    }
  });
  if (coverage) {
    res.status(200).json(coverage)
  } else {
    res.status(404).send("Project/branch and/or test does not exist.")
  }
})
app.get<ProjectParams>('/coverage/:projectName/:branch/:testName/chart', async (req, res) => {
  const coverage = await connection.manager.find(Coverage, {
    where: {
      projectName: req.params.projectName,
      branch: req.params.branch,
      testName: req.params.testName
    },
    order: {
      createdDate: 'ASC'
    }
  });
  if (coverage) {
    if (coverage[0]?.baseBranch && coverage[0]?.baseBranch != req.params.branch) {
      //take a maximum of 10 previous tests in the main branch
      const previousCoverage = await connection.manager.find(Coverage, {
        where: {
          projectName: req.params.projectName,
          branch: coverage[0].baseBranch,
          testName: req.params.testName,
          createdDate: LessThan(coverage[0].createdDate)
        },
        order: {
          createdDate: 'DESC'
        },
        take: 10
      });
      // add everything that came before
      previousCoverage.forEach(i => {
        coverage.push(i)
      })
    }
    const stackedBarChartSpec: any = {
      "$schema": "https://vega.github.io/schema/vega/v3.0.json",
      "width": 500,
      "height": 200,
      "padding": 5,
      "background": "white",
      "title": {
        "text": { "value": "Code coverage for " + req.params.projectName + ' / ' + req.params.testName },
        "anchor": "start",
        "frame": "group"
      },
      "data": [
        {
          "name": "table",
          "format": {
            "type": "json",
            "parse": { "x": "date" }
          },
          "values": coverage.map(coverage => {
            return {
              x: coverage.createdDate.toISOString(),
              y: coverage.getCoveragePercent(),
              c: 20
            }
          }),
          "transform": [
            {
              "type": "stack",
              "groupby": ["x"],
              "sort": { "field": "c" },
              "field": "y"
            }
          ]
        }
      ],

      "scales": [
        {
          "name": "x",
          "type": "utc",
          "range": "width",
          "domain": { "data": "table", "field": "x" }
        },
        {
          "name": "y",
          "type": "linear",
          "range": "height",
          "nice": true,
          "zero": true,
          "domain": [0, 1]
        },
        {
          "name": "color",
          "type": "ordinal",
          "range": { "scheme": "category20" },
          "domain": { "data": "table", "field": "c" }
        }
      ],

      "axes": [
        { "orient": "bottom", "scale": "x", "zindex": 1, "formatType": "utc" },
        { "orient": "left", "scale": "y", "zindex": 1 }
      ],

      "marks": [
        {
          "type": "area",
          "from": { "data": "table" },
          "encode": {
            "enter": {
              "x": { "scale": "x", "field": "x" },
              "y": { "scale": "y", "field": "y" },
              "y2": { "scale": "y", "value": 0 },
              "stroke": { "scale": "color", "field": "c" },
              "strokeWidth": { "value": 0 },
              "fill": { "scale": "color", "field": "c" },
            },
            "update": {
              "fillOpacity": { "value": 0.5 }
            },
            "hover": {
              "fillOpacity": { "value": 0.5 }
            }
          }
        },
        {
          "type": "line",
          "from": { "data": "table" },
          "encode": {
            "enter": {
              "x": { "scale": "x", "field": "x" },
              "y": { "scale": "y", "field": "y" },
              "stroke": { "scale": "color", "field": "c" },
              "strokeWidth": { "value": 2 },
            },
            "update": {
              "fillOpacity": { "value": 0.5 }
            },
            "hover": {
              "fillOpacity": { "value": 0.5 }
            }
          }
        },
        {
          "type": "symbol",
          "from": { "data": "table" },
          "encode": {
            "enter": {
              "x": { "scale": "x", "field": "x" },
              "y": { "scale": "y", "field": "y" },
              "fillOpacity": { "value": 1 },
              "size": { "value": 32 }
            }
          }
        },
      ]
    }

    // create a new view instance for a given Vega JSON spec
    var view = new View(parse(stackedBarChartSpec))
      .renderer('canvas')
      .initialize();

    // generate static PNG file from chart
    view
      .toCanvas()
      .then(function (canvas: HTMLCanvasElement) {
        // process node-canvas instance for example, generate a PNG stream to write var
        console.log('success')
        res.status(200)
        res.set('content-type', 'image/png')
        //@ts-ignore
        if (canvas.toBuffer) {
          //@ts-ignore
          res.end(canvas.toBuffer(), 'binary')
        } else {
          res.end('', 'binary')
        }
      })
      .catch(function (err) {
        console.log("Error writing PNG to file:")
        console.error(err)
        res.status(500)
        res.send(err.message)
      });
  } else {
    res.status(404).send("Project and/or test does not exist.")
  }
})
app.post<ProjectParams>('/coverage/:projectName/:branch/:testName/save', (req, res) => {
  if (hasRequiredParams(req.body)) {
    const newCoverage = new Coverage()
    newCoverage.projectName = req.params.projectName
    newCoverage.branch = req.params.branch
    newCoverage.testName = req.params.testName

    requiredProperties.forEach(property => {
      newCoverage[property] = req.body[property]
    })

    connection.manager.save(newCoverage).then(result => {
      res.status(200).send('Saved')
    }).catch(error => {
      res.status(500).send(error.message)
    })
  } else {
    res.status(400).send("Missing required parameters: " + requiredProperties.join(', '))
  }
})

