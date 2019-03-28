import React from 'react'
import Case from 'case'
import { pluralize } from 'inflection'
import XRegExp from 'xregexp'

import {
  EMPTY_OPTION,
  DATA_TYPE_OPTIONS,
  NAME_FORMAT_ERROR,
  REQUIRED_NAME_ERROR,
  REQUIRED_TYPE_ERROR,
  NAME_LENGTH_ERROR,
  UNIQUE_NAME_ERROR,
  SQL_IDENTIFIER_REGEXP,
  MAX_MODEL_NAME_LENGTH
} from '../constants.js'

export default class ModelForm extends React.Component {
  constructor (props) {
    super(props)

    const model = this.props.models.find(({ id }) => id === this.props.modelId)

    this.state = {
      model: { ...model },
      newField: emptyField(),
      modelErrors: [],
      newFieldErrors: [],
      fieldErrors: emptyFieldErrors(model.fields),
      nextFieldId: this.props.nextFieldId
    }
  }

  save = () => {
    const model = formatModel(this.state.model)
    const modelErrors = validateModel(model, this.props.models)

    const fieldErrors = model.fields.reduce(
      (acc, field) => ({
        ...acc,
        [field.id]: validateField(field, this.state.model.fields)
      }),
      this.state.fieldErrors
    )

    if (!this.checkErrors(modelErrors, fieldErrors)) {
      this.props.onSave({
        model,
        nextFieldId: this.state.nextFieldId
      })
    } else {
      this.setState({ model, modelErrors, fieldErrors })
    }
  }

  cancel = () => this.props.onCancel()

  // Model

  inputModelName = name => this.mapModel(model => ({ ...model, name }))

  mapModel = fn => {
    const model = fn(this.state.model)

    const modelErrors =
      this.state.modelErrors.length > 0
        ? validateModel(formatModel(model), this.props.models)
        : this.state.modelErrors

    this.setState({ model, modelErrors })
  }

  // New Field

  inputNewFieldName = name => this.mapNewField(field => ({ ...field, name }))

  selectNewFieldType = type => this.mapNewField(field => ({ ...field, type }))

  toggleNewFieldPrimaryKey = primaryKey =>
    this.mapNewField(field => ({ ...field, primaryKey }))

  toggleNewFieldRequired = required =>
    this.mapNewField(field => ({ ...field, required }))

  toggleNewFieldUnique = unique =>
    this.mapNewField(field => ({ ...field, unique }))

  mapNewField = fn => {
    const newField = fn(this.state.newField)

    const newFieldErrors =
      this.state.newFieldErrors.length > 0
        ? validateField(formatField(newField), this.state.model.fields)
        : this.state.newFieldErrors

    this.setState({ newField, newFieldErrors })
  }

  clearNewField = () =>
    this.setState({ newField: emptyField(), newFieldErrors: [] })

  createField = () => {
    const newField = formatField(this.state.newField)
    const newFieldErrors = validateField(newField, this.state.model.fields)

    if (newFieldErrors.length > 0) {
      this.setState({ newField, newFieldErrors })
    } else {
      const field = buildField(this.state.nextFieldId, newField)
      const fieldErrors = { ...this.state.fieldErrors, [field.id]: [] }

      this.setState({
        model: {
          ...this.state.model,
          fields: [...this.state.model.fields, field]
        },
        newField: emptyField(),
        newFieldErrors: [],
        fieldErrors,
        nextFieldId: this.state.nextFieldId + 1
      })
    }
  }

  // Fields

  inputFieldName = (id, name) =>
    this.mapField(id, field => ({ ...field, name }))

  selectFieldType = (id, type) =>
    this.mapField(id, field => ({ ...field, type }))

  toggleEditingFieldPrimaryKey = (id, primaryKey) =>
    this.mapField(id, field => ({ ...field, primaryKey }))

  toggleEditingFieldRequired = (id, required) =>
    this.mapField(id, field => ({ ...field, required }))

  toggleEditingFieldUnique = (id, unique) =>
    this.mapField(id, field => ({ ...field, unique }))

  mapField = (id, fn) => {
    const currentField = this.state.model.fields.find(field => field.id === id)
    const currentErrors = this.state.fieldErrors[id]

    const field = fn(currentField)
    const errors =
      currentErrors.length > 0
        ? validateField(formatField(field), this.state.model.fields)
        : currentErrors

    const fields = this.state.model.fields.map(f => (f.id === id ? field : f))
    const fieldErrors = { ...this.state.fieldErrors, [id]: errors }

    this.setState({ model: { ...this.state.model, fields }, fieldErrors })
  }

  deleteField = id => {
    const { [id]: _, ...fieldErrors } = this.state.fieldErrors
    const fields = this.state.model.fields.filter(field => field.id !== id)
    this.setState({ model: { ...this.state.model, fields }, fieldErrors })
  }

  // Errors

  hasErrors = () =>
    this.hasModelErrors() || this.hasNewFieldErrors() || this.hasFieldErrors()

  hasModelErrors = () => this.state.modelErrors.length > 0
  hasNewFieldErrors = () => this.state.newFieldErrors.length > 0
  hasFieldErrors = () =>
    Object.values(this.state.fieldErrors).some(errors => errors.length > 0)

  fieldHasErrors = id => this.state.fieldErrors[id].length > 0
  checkErrors = (modelErrors, fieldErrors) =>
    modelErrors.length > 0 ||
    Object.values(fieldErrors).some(errors => errors.length > 0)
  render () {
    return (
      <React.Fragment>
        <button onClick={this.save} disabled={this.hasErrors()}>
          Save
        </button>
        <button onClick={this.cancel}>Cancel</button>
        <label htmlFor='editing-model-name'>Name</label>
        <input
          id='editing-model-name'
          type='text'
          value={this.state.model.name}
          onChange={evt => this.inputModelName(evt.target.value)}
        />
        {this.hasModelErrors() ? (
          <ul>
            {this.state.modelErrors.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <h3>Fields</h3>
        <form
          onSubmit={evt => {
            evt.preventDefault()
            this.createField()
          }}
        >
          <strong>NewField</strong>
          <label htmlFor='new-field-name'>Name</label>
          <input
            id='new-field-name'
            type='text'
            value={this.state.newField.name}
            onChange={evt => this.inputNewFieldName(evt.target.value)}
          />
          <label htmlFor='new-field-type'>Type</label>
          <select
            id='new-field-type'
            default={this.state.newField.type || EMPTY_OPTION}
            value={this.state.newField.type || EMPTY_OPTION}
            onChange={evt =>
              this.selectNewFieldType(optionToValue(evt.target.value))
            }
          >
            {Object.entries(DATA_TYPE_OPTIONS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <label htmlFor='new-field-primary-key'>Primary Key</label>
          <input
            id='new-field-primary-key'
            type='checkbox'
            checked={this.state.newField.primaryKey}
            onChange={evt => this.toggleNewFieldPrimaryKey(evt.target.checked)}
          />
          <label htmlFor='new-field-unique'>Unique</label>
          <input
            id='new-field-unique'
            type='checkbox'
            checked={this.state.newField.unique}
            onChange={evt => this.toggleNewFieldUnique(evt.target.checked)}
          />
          <label htmlFor='new-field-required'>Required</label>
          <input
            id='new-field-required'
            type='checkbox'
            checked={this.state.newField.required}
            onChange={evt => this.toggleNewFieldRequired(evt.target.checked)}
          />
          {this.hasNewFieldErrors() ? (
            <ul>
              {this.state.newFieldErrors.map(message => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          <button type='submit' disabled={this.hasNewFieldErrors()}>
            Add
          </button>
          <button type='button' onClick={this.clearNewField}>
            Clear
          </button>
        </form>
        <ul>
          {this.state.model.fields.map(field => (
            <li key={field.id}>
              <label htmlFor={`editing-field-name-${field.id}`}>Name</label>
              <input
                id={`editing-field-name-${field.id}`}
                type='text'
                value={field.name}
                onChange={evt =>
                  this.inputFieldName(field.id, evt.target.value)
                }
              />
              <label htmlFor={`editing-field-type-${field.id}`}>Type</label>
              <select
                id={`editing-field-type-${field.id}`}
                default={field.type || EMPTY_OPTION}
                value={field.type || EMPTY_OPTION}
                onChange={evt =>
                  this.selectFieldType(
                    field.id,
                    optionToValue(evt.target.value)
                  )
                }
              >
                {Object.entries(DATA_TYPE_OPTIONS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
              <label htmlFor={`editing-field-primary-key-${field.id}`}>
                Primary Key
              </label>
              <input
                id={`editing-field-primary-key-${field.id}`}
                type='checkbox'
                checked={field.primaryKey}
                onChange={evt =>
                  this.toggleEditingFieldPrimaryKey(
                    field.id,
                    evt.target.checked
                  )
                }
              />
              <label htmlFor={`editing-field-unique-${field.id}`}>
                Unique}
              </label>
              <input
                id={`editing-field-unique-${field.id}`}
                type='checkbox'
                checked={field.unique}
                onChange={evt =>
                  this.toggleEditingFieldUnique(field.id, evt.target.checked)
                }
              />
              <label htmlFor={`editing-field-required-${field.id}`}>
                Required
              </label>
              <input
                id={`editing-field--required-${field.id}`}
                type='checkbox'
                checked={field.required}
                onChange={evt =>
                  this.toggleEditingFieldRequired(field.id, evt.target.checked)
                }
              />
              <button onClick={() => this.deleteField(field.id)}>Delete</button>
              {this.fieldHasErrors(field.id) ? (
                <ul>
                  {this.state.fieldErrors[field.id].map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </React.Fragment>
    )
  }
}

const optionToValue = value => (value === EMPTY_OPTION ? null : value)
const formatModel = model => ({
  ...model,
  name: model.name.trim(),
  fields: model.fields.map(field => formatField(field))
})
const formatField = field => ({ ...field, name: field.name.trim() })
const buildField = (id, field) => ({ id, ...field })
const validateModel = (model, models) => {
  const errors = [
    [
      UNIQUE_NAME_ERROR,
      !!models.find(
        ({ name, id }) =>
          Case.snake(name) === Case.snake(model.name) && id !== model.id
      )
    ],
    [NAME_FORMAT_ERROR, !XRegExp(SQL_IDENTIFIER_REGEXP).test(model.name)],
    [REQUIRED_NAME_ERROR, model.name.length === 0],
    [
      NAME_LENGTH_ERROR,
      pluralize(Case.snake(model.name)).length > MAX_MODEL_NAME_LENGTH
    ]
  ]

  console.log(errors)

  return errors.filter(error => error[1]).map(error => error[0])
}

const validateField = (field, fields) => {
  const errors = [
    [
      UNIQUE_NAME_ERROR,
      !!fields.find(
        ({ name, id }) =>
          Case.snake(name) === Case.snake(field.name) && id !== field.id
      )
    ],
    [NAME_FORMAT_ERROR, !XRegExp(SQL_IDENTIFIER_REGEXP).test(field.name)],
    [REQUIRED_NAME_ERROR, field.name.length === 0],
    [NAME_LENGTH_ERROR, Case.snake(field.name).length > MAX_MODEL_NAME_LENGTH],
    [REQUIRED_TYPE_ERROR, field.type === null]
  ]
  console.log(errors)

  return errors.filter(error => error[1]).map(error => error[0])
}

const emptyField = () => ({
  name: '',
  type: null,
  primaryKey: false,
  required: false,
  unique: false
})

const emptyFieldErrors = fields =>
  fields.reduce((acc, { id }) => ({ ...acc, [id]: [] }), {})