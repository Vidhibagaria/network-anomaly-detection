export function EntryListEditor({ items, config, itemLabel, onUpdate, onRemove }) {
  return items.map((item, index) => (
    <div className="entry-card" key={`${itemLabel}-${index}`}>
      <div className="entry-header">
        <span className="entry-number">
          {itemLabel} {index + 1}
        </span>
        <button className="btn-remove" type="button" onClick={() => onRemove(index)}>
          Remove
        </button>
      </div>
      {config.map((row, rowIndex) => {
        if (row.type === 'row') {
          return (
            <div className="form-row" key={`${itemLabel}-${index}-row-${rowIndex}`}>
              {row.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={item[field.key]}
                  onChange={(value) => onUpdate(index, field.key, value)}
                />
              ))}
            </div>
          );
        }

        return (
          <Field
            key={`${itemLabel}-${index}-${row.key}`}
            field={row}
            value={item[row.key]}
            onChange={(value) => onUpdate(index, row.key, value)}
          />
        );
      })}
    </div>
  ));
}

function Field({ field, value, onChange }) {
  return (
    <div className="form-group">
      <label>{field.label}</label>
      {field.element === 'textarea' ? (
        <textarea
          rows={field.rows || 2}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={field.type || 'text'}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
