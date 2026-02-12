const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server Running at http://localhost:3000')
    })
  } catch (e) {
    console.log('DB Error:${e.message}')
    process.exit(1)
  }
}

initializeDBandServer()

const authenicationToken = (request, response, next) => {
  let jwtToken
  let authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'vagesh', error => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// create user API

app.post('/users/', async (request, response) => {
  const {username, name, password, gender, location} = request.body

  const hashedPassword = await bcrypt.hash(password, 10)

  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    //create user in user table
    const createUserQuery = `INSERT INTO 
    user(username,name,password,gender,location)
    VALUES
    (
      '${username}',
      '${name}',
      '${hashedPassword}',
      '${gender}',
      '${location}'
    );
    `

    await db.run(createUserQuery)
    response.send('User created Successfully')
  } else {
    //send invalid user as response
    response.status(400)
    response.send('User already exists')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    //user does not exists
    response.status(400)
    response.send('Invalid user')
  } else {
    // compare password,hashed password
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'vagesh')

      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenicationToken, async (request, response) => {
  const stateQuery = `
         SELECT
         state_id as stateId,
  state_name as stateName,
  population  
  FROM state 
         `

  const stateArray = await db.all(stateQuery)
  response.send(stateArray)
})

app.get('/states/:stateId/', authenicationToken, async (request, response) => {
  const {stateId} = request.params

  const getoneState = `
  SELECT 
  state_id as stateId,
  state_name as stateName,
  population  
  FROM state 
  WHERE state_id=${stateId} `
  const getState = await db.get(getoneState)
  response.send(getState)
})

app.post('/districts/', authenicationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const createDistrictQuery = `
  INSERT INTO 
  district(district_name,state_id,cases,cured,active,deaths)
  VALUES
  ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`

  const district = await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenicationToken,
  async (request, response) => {
    const {districtId} = request.params

    const getDistrict = `
  SELECT district_id as districtId,
  district_name as districtName,
  state_id as stateId,
  cases,cured,active,deaths
  FROM district
  WHERE district_id=${districtId}`

    const district = await db.get(getDistrict)
    response.send(district)
  },
)

app.delete(
  '/districts/:districtId/',
  authenicationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrict = `
  DELETE  FROM district
  WHERE district_id=${districtId};`
    await db.run(deleteDistrict)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenicationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateDistrict = `
update district
SET
'district_name'='${districtName}',
state_id=${stateId},
cases=${cases},
cured=${cured},
active=${active},
deaths=${deaths}
WHERE district_id = ${districtId}`

    await db.run(updateDistrict)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenicationToken,
  async (request, response) => {
    const {stateId} = request.params
    const stateDetails = `
  SELECT 
  sum(cases) as totalCases,
  sum(cured) as totalCured,
  sum(active) as totalActive,
  sum(deaths) as totalDeaths
  from district
  WHERE state_id=${stateId};`
    const totalCases = await db.get(stateDetails)
    response.send(totalCases)
  },
)

module.exports = app
