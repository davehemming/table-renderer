(function($, undefined) {

	$.widget('dh.tablerenderer', {

		version: '0.0.3',

		_create: function() {
			this.cols = {};
			this.table = {
				elements: undefined,
				staticCells: {
					$delete: undefined,
					$edit: undefined
				},
				ajax: {
					onDelete: {
						active: false,
						url: undefined
					},
					onUpdate: {
						active: false,
						url: undefined
					},
					onInsert: {
						active: false,
						url: undefined
					}
				},
				columns: {},
				columnOrder: [],
				records: {},
				currentlyEditing: undefined
			};
			this.form = {
				buttons: {
					add: undefined,
					clear: undefined
				},
			}

			// this is hack to make Organisation Affiliations work. Needed because two fields could be identified as the primary key.  Fix it when you get a chance so this boolean is not needed.
			this.isRecordIdSet = false;

		},

		_init: function() {
			this.table.staticCells.$delete = $('<td><a href="javascript:;" class="fa fa-trash-o" title="" data-action="delete"></a></td>');
			this.table.staticCells.$edit = $('<td><a href="javascript:;" class="fa fa-edit edit-row" title="" data-action="edit"></a></td>');

			this.table.columns = this._getColumns();
			this.table.columnOrder = this._getColumnOrder(this.table.columns);
			this.table.elements = this._getTableElement();
			this._bindTableClickEvent();
			this._bindButtons();
			this._renderTableHead(this.table);
			this._loadRecords();

			if (this.options.ajax) {
				this.table.ajax = $.extend(true,this.table.ajax, this.options.ajax);
			}

			if (this.options.instanceVars && this.options.instanceVars.init) {
				this.options.instanceVars.init();
			}

			this._trigger('widgetinitialized', null, {
				columns: this.table.columns,
				records: this.table.records
			});
		},

		_getColumns: function() {

			var self = this;

			var columns = {};

			var columnTemplate = {
				input: undefined,
				header: undefined,
				// isVisible: undefined,
				order: undefined
			}

			var inputs = this._getFormInputs();

			$.each(inputs, function(index, input) {
				var columnName;
				if (input.$elements.data().columnName) {
					columnName = input.$elements.data().columnName;
				} else {
					columnName = self._generateColumnName(this.oldName);
				}

				columns[columnName] = $.extend(true, {}, columnTemplate);
				columns[columnName].input = this;
				columns[columnName].header = this.$elements.data('header');
				columns[columnName].order = this.$elements.data('column-order');
			});

			return columns;

		},

		_getFormInputs: function() {

			var inputTemplate = {
				name: undefined,
				oldName: undefined,
				type: undefined,
				$elements: undefined,
				$hiddenValidationField: undefined,
				$hiddenValueField: undefined,
				reset: undefined,
				getValue: undefined,
				setValue: undefined,
				formatting: {
					toSystem: undefined,
					fromSystem: undefined
				}
			}

			var self = this;
			var inputs = [];
			var elementsCollection = this._getElementsCollection();

			$.each(elementsCollection, function() {

				var input = $.extend(true, {}, inputTemplate);
				input.$elements = this;
				var name = input.$elements.first().attr('name');
				var newName = self._generateNewInputName(name);
				input.type = self._getElementType(input.$elements);

				var $hvf = self._getHiddenValidationField(input);
				if ($hvf !== undefined) {
					input.$hiddenValidationField = $hvf.clone().removeAttr('id');
					input.$elements = input.$elements.not($hvf);
				}
				input.$hiddenValueField = self._generateHiddenValueField(name);


				this.each(function() {
					var newId = self._generateNewInputId($(this).attr('id'));
					$(this).attr('id', newId);
					$(this).attr('name', newName);
				});

				self._attachGettersAndSetters(input);
				input.oldName = name;
				input.name = newName;
				inputs.push(input);
				self._trigger('inputinit', null, input);
			});

			return inputs;

		},

		_getElementsCollection: function() {
			var elementsCollection = [];

			$.each(this.element.find('input[name], select[name]').not('table input, input[data-ignore="true"]'), function() {

				var $e = $(this);
				var index;
				$.each(elementsCollection, function(i, v) {

					if ($(this).first().attr('name') === $e.attr('name')) {
						index = i;
						return;
					}
				});

				if (index === undefined) {
					elementsCollection.push($e);

				} else {
					elementsCollection[index] = elementsCollection[index].add($e);
				}

			});

			return elementsCollection;
		},

		_getElementType: function($elements) {

			var $field;
			var type;

			if ($elements.length === 1) {
				$field = $elements.first();
			} else {
				$field = $elements.not('[type="hidden"]').first();
			}

			if ($field.prop('tagName') === 'INPUT') {
				type = $field.attr('type');
			} else {
				type = $field.prop('tagName').toLowerCase();
			}

			if (type === 'hidden' && !this.isRecordIdSet) {
				if ($field.attr('name').lastIndexOf('[id]') !== -1) {
					type = 'record_id';
					this.isRecordIdSet = true;
				}
			} else if (type === 'hidden' && $field.hasClass('form-control')) {
				type = 'select2';
			}

			return type;

		},

		_getHiddenValidationField: function(input) {

			var hvf;

			if (input.type === 'checkbox' || input.type === 'radio') {
				hvf = input.$elements.filter('[type="hidden"]');
			}

			return hvf;
		},

		_attachGettersAndSetters: function(input) {
			var self = this;

			if (input.type === 'text' || input.type === 'record_id' || input.type === 'hidden' || input.type === 'email') {

				input.getValue = function() {
					return this.$elements.val();
				};
				input.reset = function() {
					this.$elements.val('');
				};
				input.setValue = function(value) {
					this.$elements.val(value);
				};

				if (input.$elements.data('control-type') === 'date') {
					input.formatting.toSystem = function(value) {
						return value.replace( /(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
					};
					input.formatting.fromSystem = function(value) {
						return value.replace( /(\d{4})-(\d{2})-(\d{2})/, "$3-$2-$1");
					};
				}

			} else if (input.type === 'number') {

				if (input.$elements.hasClass('currency')) {

					input.getValue = function() {
						// return this.$elements.val();
						return parseFloat(Math.round(this.$elements.val() * 100) / 100).toFixed(2);
					};
					input.reset = function() {
						this.$elements.val('0.00');
					};
					input.setValue = function(value) {
						this.$elements.val(value);
					};
				} else {

					input.getValue = function() {
						return this.$elements.val();
					};
					input.reset = function() {
						this.$elements.val('');
					};
					input.setValue = function(value) {
						this.$elements.val(value);
					};
				}


			} else if (input.type === 'select') {
				input.getValue = function() {
					return this.$elements.val();
				};
				input.getText = function(value) {
					// console.log(value === '');
					if (typeof value === 'undefined') {
						return this.$elements.find('option:selected').text();
					} else if (value === '' || value === null) {
						return '';
					} else {
						return this.$elements.find('option[value="' + value + '"]').text();
					}

				};
				input.reset = function() {
					this.$elements.val('');
				};
				input.setValue = function(value) {
					this.$elements.val(value);
				};
			} else if (input.type === 'checkbox') {
				input.getValue = function() {
					return + this.$elements.is(':checked');
				};
				input.reset = function() {
					this.$elements.attr('checked', false);
				};
				input.setValue = function(value) {
					this.$elements.prop('checked', !!parseInt(value));
				};
			} else if (input.type === 'radio') {
				input.getValue = function() {

					value = $('input[name="' + this.$elements.prop('name') + '"]:checked').val();

					if (typeof value === 'undefined') {
						return '';
					} else {
						return value;
					}
				};
				input.reset = function() {
					this.$elements.prop('checked', false);
				};
				input.setValue = function(value) {

					if (typeof value === 'string' && value.length !== 0) {
						$('input[name="' + this.$elements.first().prop('name') + '"][value=' + value + ']').prop('checked', true);
					}

				}
			} else if (input.type === 'select2') {
				input.getValue = function() {
					return this.$elements.select2('val');
				};
				input.getText = function() {
					return this.$elements.select2('data').text;
				};
				input.reset = function() {
					this.$elements.select2('val', '');
				};
				input.setValue = function(value, text) {
					var data = {id: value, text: text};
					this.$elements.select2("data", data);
				}
			}

			input.getHiddenValueField = function(columnName, value, text) {

				$hf = this.$hiddenValueField.clone().val(value);
				$hf.attr('data-text', text);
				$hf.attr('data-column-name', columnName);

				return $hf;
			}

			input._getHiddenValidationField = function() {

				var $hvf =
					(this.$hiddenValidationField)
					? this.$hiddenValidationField.clone()
					: '';

				return $hvf;
			}
		},

		_generateNewInputName: function(name) {
			var newName;
			newName = name.replace(/data/, '');
			newName = newName.replace(/\[\d\]/, '');

			return newName;
		},

		_generateColumnName: function(name) {
			var newName;

			newName = name.replace(/data/, '');
			newName = newName.replace(/((\[|\_)\w)/g, function(a,x) {
				return a.toUpperCase();
			});
			newName = newName.replace(/(\d|\[|\]|\_)/g, '');

			return newName;
		},

		_generateNewInputId: function(id) {
			var newId;

			newId = id.replace(/\d/, '');

			return newId;
		},

		_generateHiddenValueField: function(name) {
			return $('<input type="hidden" name="' + name + '" value />');
		},

		_bindButtons: function() {
			var self = this;

			this.element.find('button').each(function() {
				// console.log(this);
				var $e = $(this);

				if ($e.data('action') === 'add') {
					self._on($e, {'click': self.saveRecord});
					self.form.buttons.add = $e;
				} else if ($e.data('action') === 'clear') {
					self._on($e, {'click': self.clearForm});
					self.form.buttons.clear = $e;
				}
			});
		},

		_getTableElement: function() {
			var table = {};

			table.$table = this.element.find('table');
			table.$thead = this.element.find('thead');
			table.$tbody = this.element.find('tbody');

			if (table.$thead.length === 0) {
				table.$thead = $('<thead />');
				table.$table.append(table.$thead);
			}

			if (table.$tbody.length === 0) {
				table.$tbody = $('<tbody />');
				table.$table.append(table.$tbody);
			}

			return table;

		},

		_renderTableHead: function(table) {

			if (table.elements.$thead.find('tr').length === 0) {

				var $row = $('<tr/>');

				$.each(table.columnOrder, function(i, columnName) {

					if (table.columns[columnName].header) {
						$row.append($('<th>' + table.columns[columnName].header + '</th>'));
					}
				});

				$row.append('<th></th>');
				$row.append('<th></th>');

				this.table.elements.$thead.append($row);
			}

		},

		_renderTableBody: function() {

			self = this;

			this.table.elements.$tbody.empty();

			$.each(this.table.records, function(id, record) {
				// potentially want to use css to hide the row instead of not rendering it at all.
				if (record.isVisible) {
					self._renderTableRow(id, record);
				}
			});
		},

		_getColumnOrder: function(columns) {
			var columnOrder = [];

			$.each(columns, function(k, v) {

				if (this.order !== undefined) {
					columnOrder[this.order -1] = k;
				}
			});

			$.each(columns, function(k, v) {
				if (this.order === undefined) {
					columnOrder.push(k);
				}
			});

			return columnOrder;
		},

		saveRecord: function() {

			var self = this;
			var promise = undefined;


			this._isFormValid(function() {
				var record = self._getFormValues();
				// var performAction = true;

				if (self.table.currentlyEditing) {

					if (self.table.ajax.onInsert.active &&
						self.table.ajax.onInsert.url) {
						promise = self._performAjaxTransaction('update', record);
					} else {
						// ugly hack because I cant be bothered, remove duplication between ajax and non ajax response when you get time
						record.id = self.table.currentlyEditing;
						self.table.records[self.table.currentlyEditing] = record;
						self.clearForm();
						self._toggleButtonState();
						self._trigger('recordupdate', null, record);
						self._renderTableBody();
					}

					if (promise) {
						promise.done(function(data) {
							if (!!data === false) {
								alert('An error occurred and the record could not be updated.');
							} else {
								record.id = self.table.currentlyEditing;
								self.table.records[self.table.currentlyEditing] = record;
								self.clearForm();
								self._toggleButtonState();
								self._trigger('recordupdate', null, record);
								self._renderTableBody();
							}
						});
						promise.fail(function() {
							alert('An error occurred and the record could not be updated.');
						});
					}

				} else {
					if (self.table.ajax.onInsert.active && self.table.ajax.onInsert.url) {
						promise = self._performAjaxTransaction('insert', record);
					} else {
						// ugly hack because I cant be bothered, remove duplication between ajax and non ajax response when you get time
						recordId = self._generateRecordId();
						record.id = recordId;
						self.table.records[recordId] = record;
						self.clearForm();
						self._trigger('recordinsert', null, record);
						self._renderTableBody();
					}

					if (promise) {
						promise.done(function(data) {
							if (!!data === false) {
								alert('An error occurred and the record could not be created.');
							} else {
								record.setPrimaryKey(data);
								recordId = self._generateRecordId();
								record.id = recordId;
								self.table.records[recordId] = record;
								self.clearForm();
								self._trigger('recordinsert', null, record);
								self._renderTableBody();
							}
						});

						promise.fail(function() {
							alert('An error occurred and the record could not be created.');
						});
					}

				}
			},
			function() {
				console.log('form is not valid');
			});

		},

		_generateRecordId: function() {
			var number = Math.floor(Math.random() * $.now());

			return number;
		},

		_getFormValues: function() {
			var self = this;
			var record = {
				id: undefined,
				isVisible: true,
				cssClasses: [],
				getPrimaryKey: undefined,
				setPrimaryKey: undefined,
				fields: {}

			};

			$.each(this.table.columns, function(colName, col) {

				if (this.input.getValue) {

					record.fields[colName] = {};
					record.fields[colName].value = (this.input.formatting.toSystem)
						? this.input.formatting.toSystem(this.input.getValue())
						: this.input.getValue();
					record.fields[colName].text = (this.input.getText)
						? this.input.getText()
						: record.fields[colName].value;
					record.fields[colName].text = (this.input.formatting.fromSystem)
						? this.input.formatting.fromSystem(record.fields[colName].text)
						: record.fields[colName].text;
					if (this.input.type === 'record_id') {
						record.getPrimaryKey = function() {
							return this.fields[colName].value;
						};

						record.setPrimaryKey = function(key) {
							this.fields[colName].value = key;
						};

					};

					// remove this later:
					record.fields[colName].isPrimaryKey = (this.input.type === 'record_id')
						? true
						: false;
				}

			});

			return record;
		},

		_isFormValid: function(validCallback, invalidCallback) {

			var self = this;

			this._trigger('checkformisvalid', null, {
				columns: self.table.columns,
				valid: function() {
					validCallback();
				},
				invalid: function() {
					//valid = false
					invalidCallback();
				}
			});
		},

		_setFormValues: function(record) {

			$.each(this.table.columns, function(colName, col) {
				var text = '';
				if (record.fields[colName].text) {
					text = record.fields[colName].text;
				}
				this.input.setValue(record.fields[colName].value, text);
			});
		},

		_deleteRecord: function($row) {
			var self = this;
			var msg = 'Are you sure you want to delete the selected record?';
			$row.addClass('highlight-delete');
			var promise = undefined;

			if (confirm(msg)) {
				var recordId = $row.data().recordId;
				var record = this.table.records[recordId];

				if (record.getPrimaryKey() &&
					record.getPrimaryKey() !== '' &&
					this.table.ajax.onDelete.active &&
					this.table.ajax.onDelete.url) {

					promise = this._performAjaxTransaction('delete', record);

				} else {
					// ugly hack. remove duplication between ajax and non ajax responses when you get time
					self.clearForm();
					delete self.table.records[recordId];
					self._renderTableBody();
					self._trigger('recorddeleted', null, record);
				}

				if (promise) {
					promise.done(function(data) {
						if (!!data === false) {
							alert('An error occurred and the selected record could not be deleted.');
						} else {
							self.clearForm();
							delete self.table.records[recordId];
							self._renderTableBody();
							self._trigger('recorddeleted', null, record);
						}
					});
					promise.fail(function() {
						alert('An error occurred and the selected record could not be deleted.');
					});


				}

			}

			$row.removeClass('highlight-delete');

		},

		_editRecord: function(recordId) {
			this.table.currentlyEditing = recordId;
			this._setFormValues(this.table.records[recordId]);
			this._toggleButtonState();
		},

		_performAjaxTransaction: function(type, record) {
			var url = undefined;
			var data = undefined;
			var result = undefined;

			if (type === 'delete') {
				var primaryKey = record.getPrimaryKey();

				if (primaryKey && primaryKey !== '') {
					url = this.table.ajax.onDelete.url + '/' + primaryKey;
				}

			} else if (type === 'insert') {
				var $form = this._generateForm(record);
				data = $form.serialize();
				url = this.table.ajax.onInsert.url;
			} else if (type === 'update') {
				var $form = this._generateForm(record);
				data = $form.serialize();

				var primaryKey = record.getPrimaryKey();

				if (primaryKey && primaryKey !== '') {
					url = this.table.ajax.onUpdate.url + '/' + primaryKey;
				}
			}

			$('body').addClass('wait');

			if (url) {

				return $.ajax({
					url: url,
					type: 'POST',
					data: data,

				}).always(function() {
					$('body').removeClass('wait');
				});
			}

			return undefined;

		},

		_loadRecords: function() {
			var self = this;

			this.table.elements.$tbody.find('tr').each(function() {

				var record = {
					id: undefined,
					isVisible: true,
					cssClasses: [],
					getPrimaryKey: undefined,
					setPrimaryKey: undefined,
					fields: {}
				};
				$(this).find('input[data-column-name]').each(function() {
					$e = $(this);
					var columnName = $e.data().columnName;
					record.fields[columnName] = {};
					record.fields[columnName].value = $e.val();
					record.fields[columnName].text = $e.data('text');

					if ($e.data().primaryKey) {
						record.getPrimaryKey = function() {
							return this.fields[columnName].value;
						};

						record.setPrimaryKey = function(key) {
							this.fields[colName].value = key;
						};

					};

					// remove this later
					record.fields[columnName].isPrimaryKey = ($e.data().primaryKey)
						? true
						: false;
				});

				var recordId = self._generateRecordId();
				// $.data not working again, i have no idea why
				$(this).attr('data-record-id', recordId);
				record.id = recordId;
				self.table.records[recordId] = record;
				self._trigger('recordloaded', null, record);

			});

			this._renderTableBody();


		},

		_generateForm: function(record) {
			var self = this;

			var $form = $('<form/>');

			$.each(this.table.columns, function(columnName) {
				$form.append(this.input._getHiddenValidationField());
				$form.append(this.input.getHiddenValueField(columnName, record.fields[columnName].value, record.fields[columnName].text));

			});

			return $form;

		},

		_renderTableRow: function(recordId, record) {
			var self = this;
			var cssClasses = record.cssClasses.join(' ');
			var $row = $('<tr data-record-id="'+recordId+'" class="' + cssClasses + '" />');
			var $firstCell;
			$.each(this.table.columnOrder, function(index, columnName) {

				if (self.table.columns[columnName].header) {
					var $cell = $('<td/>');
					var text = (record.fields[columnName].text)
					? record.fields[columnName].text
					: '';

					if (!$firstCell) $firstCell = $cell;
					$cell.append($('<span>' + text + '</span>'));
					$row.append($cell);
				}
			});

			$.each(this.table.columns, function(columnName) {
				$firstCell.append(this.input._getHiddenValidationField());
				$firstCell.append(this.input.getHiddenValueField(columnName, record.fields[columnName].value, record.fields[columnName].text));

			});

			$row.append(this.table.staticCells.$edit.clone());
			$row.append(this.table.staticCells.$delete.clone());

			var inputs = $row.find('input');
			inputs.each(function() {
				$e = $(this);
				var name = $e.attr('name').replace(/\d+/, self.table.elements.$tbody.find('tr').length);
				$e.attr('name', name);
			});

			this.table.elements.$tbody.append($row);

		},

		clearForm: function() {
			var self = this;
			$.each(this.table.columns, function(colName, col) {

				if (this.input.reset) {

					var resetField = true;

					self._trigger('inputreset', null, {
						input: this.input,
						cancelReset: function() {resetField = false;}
					});

					if (resetField) {
						this.input.reset();
					}
				}

			});

			this.table.currentlyEditing = undefined;
			this._toggleButtonState();
		},

		_bindTableClickEvent: function() {
			this._on(this.table.elements.$tbody, {
				click: this.tbodyClick
			});
		},

		tbodyClick: function(e) {
			var $target = $(e.target);

			if ($target.get(0).tagName === 'A') {

				if ($target.data('action') === 'delete') {
					this._deleteRecord($target.closest('tr'));
				} else if ($target.data('action') === 'edit') {
					this.clearForm();
					this._editRecord($target.closest('tr').data().recordId);
				}
			}
		},

		_toggleButtonState: function() {

			if (this.table.currentlyEditing) {
				this.form.buttons.add.html('Save');
				this.form.buttons.clear.html('Cancel');
			} else {
				this.form.buttons.add.html('Add');
				this.form.buttons.clear.html('Clear');
			}
		},

		setColumnValues: function(columnName, settings) {

			var temp = {
				oldValue: undefined,
				newValue: undefined,
				excludeRecords: [],
				expression: undefined
			}
			var self = this;

			if (settings.expression === undefined) {

				if (settings.oldValue === undefined) {
					settings.expression =
					function(record, field, input, excludeRecords, newValue) {
						if ($.inArray(record.id, settings.excludeRecords) === -1) {
							field.value = newValue;
							field.text = (input.getText)
								? input.getText(newValue)
								: newValue;
						}

					}
				} else {
					settings.expression =
					function(record, field, input, excludeRecords, newValue, oldValue) {
						if ($.inArray(record.id, settings.excludeRecords) === -1) {
							if (field.value === oldValue) {
								field.value = newValue;
								field.text = (input.getText)
									? input.getText(newValue)
									: newValue;
							}
						}
					}
				}

			}

			$.each(this.table.records, function() {

				settings.expression(this, this.fields[columnName], self.table.columns[columnName].input, settings.excludeRecords, settings.newValue, settings.oldValue);

			});

			this._renderTableBody();
		},

		setRecordValues: function(expression) {
			var instanceVars = this.getInstanceVariables();

			$.each(this.table.records, function() {
				expression(this, instanceVars);
			});

			this._renderTableBody();
		},

		getInstanceVariables: function() {
			if (this.options.instanceVars) {
				return this.options.instanceVars;
			}

			return null;
		}

	});
})(jQuery);