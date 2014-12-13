<?php
App::uses('AppHelper', 'View/Helper');

class TableHelper extends AppHelper {
	public $helpers = array('Html', 'Form');

	// hack to make organisation affiliations work. fix later.
	private $isPrimaryKeyFieldSet = false;

	private function _formatDateText($dateText) {

		// Debugger::dump($dateText);
		$dateText = preg_replace('/(\d{4})-(\d{2})-(\d{2})/', '${3}-${2}-${1}', $dateText);
		// Debugger::dump($t);
		return $dateText;
	}

	private function _traverseArray($location, $arr) {
		// Debugger::dump($location);
		// Debugger::dump($arr);

		$location = explode('.', $location);

		$value = $arr;
		foreach($location as $k => $v) {
			if (!isset($value[$v])) {
				// Debugger::dump('NOT SET:' . $v);
				return null;
			}
			$value = $value[$v];
		}

		return $value;

	}

	private function _getText($field, $record) {

		// Debugger::dump($record);

		if (isset($field['options']['data-header'])) {

			$text = '';

			if (isset($field['textLocation'])) {
				$text = $this->_traverseArray($field['textLocation'], $record);
			} else {
				preg_match('/\d+\.(.+?$)/', $field['fieldName'], $m);
				$textLocation = $m[1];

				$text = $this->_traverseArray($textLocation, $record);

				if (isset($field['options']['data-control-type']) && $text != null) {
					// Debugger::dump($text);
					if ($field['options']['data-control-type'] == 'date') {
						$text = $this->_formatDateText($text);
					} else if ($field['options']['data-control-type'] == 'time') {
						$text = date('H:i', strtotime($text));
					}

				}

				// Debugger::dump($m);
				// Debugger::dump($text);



				// ORIGNINAL CODE FOR ELSE:
				// $propertyName = substr(strrchr($field['fieldName'], '.'), 1);
				// // Debugger::dump($propertyName);
				// $text = $record[$propertyName];
			}

			// return '<span>' . $text . '</span>';
			return $text;
		}

		return null;
	}

	private function _generateSpanTag($field, $record) {

		if (isset($field['options']['data-header'])) {

			$text = '';

			if (isset($field['textLocation'])) {
				$text = $this->_traverseArray($field['textLocation'], $record);
			} else {
				preg_match('/\d+\.(.+?$)/', $field['fieldName'], $m);
				$textLocation = $m[1];

				$text = $this->_traverseArray($textLocation, $record);
				// $propertyName = substr(strrchr($field['fieldName'], '.'), 1);
				// $text = $record[$propertyName];
			}

			return '<span>' . $text . '</span>';
		}

		return null;
	}

	private function _getColumnName($fieldName) {

		$columnName = preg_replace_callback('/(\.|_)(\w)/', function($matches) {
			return strtoupper($matches[2]);
		}, $fieldName);
		$columnName = preg_replace('/\d/', '', $columnName);

		// Debugger::dump($columnName);

		return $columnName;
	}

	private function _generateHiddenValidationField($field, $index) {

		if (isset($field['type']) && ($field['type'] === 'checkbox' || $field['type'] === 'radio')) {
			// Debugger::dump($field);
			$value = '';
			$fieldName = preg_replace('/\d/', $index, $field['fieldName']);

			if ($field['type'] === 'checkbox') {
				$value = '0';
			}

			// Debugger::dump(htmlentities($this->Form->hidden($fieldName, array('id' => null, 'value' => $value))));

			return $this->Form->hidden($fieldName, array('id' => null, 'value' => $value));
		}

		return null;
	}

	private function _generateHiddenValueField($field, $index, $record, $text) {

		$fieldName = preg_replace('/\d/', $index, $field['fieldName'], 1);

		if (isset($field['options']['data-column-name'])) {
			$columnName = $field['options']['data-column-name'];
		} else {
			$columnName = $this->_getColumnName($fieldName);
		}

		$dataPrimaryKeyField = null;

		// Debugger::dump($this->isPrimaryKeyFieldSet);

		if (!$this->isPrimaryKeyFieldSet && substr($fieldName, -3) == '.id') {
			$dataPrimaryKeyField = true;
			$this->isPrimaryKeyFieldSet = true;
		}

		$hidden = $this->Form->hidden($fieldName, array(
			'id' => null,
			'data-column-name' => $columnName,
			'data-text' => $text,
			'data-primary-key' => $dataPrimaryKeyField
		));

		if (!preg_match('/value=/', $hidden)) {
			$value =  $this->_traverseArray($field['fieldName'], $record);
			$hidden = substr($hidden, 0, -2) . ' value="' . $value . '"/>';
		}

		return $hidden;
	}

	public function _orderColumns($fields) {
		// Debugger::dump($fields);
		$columnsOrdered = array();

		foreach($fields as $field) {
			// Debugger::dump($field);
			if (isset($field['options']['data-column-order'])) {
				$columnsOrdered[$field['options']['data-column-order'] - 1] = $field;
			}
		}

		foreach($fields as $field) {

			if (!isset($field['options']['data-column-order'])) {
				array_push($columnsOrdered, $field);
			}
		}

		ksort($columnsOrdered);

		// Debugger::dump($columnsOrdered);

		return $columnsOrdered;
	}

	public function createTable($fields, $data) {
		$editCell = '<td><a href="javascript:;" class="fa fa-edit edit-row" title="" data-action="edit"></a></td>';
		$deleteCell = '<td><a href="javascript:;" class="fa fa-trash-o" title="" data-action="delete"></a></td>';

		$table = '<table class="table table-condensed">';
		$thead = '<thead>';
		$tbody = '<tbody>';

		$thead .= '<tr>';

		$fields = $this->_orderColumns($fields);

		foreach($fields as $field) {
			$thead .= (isset($field['options']['data-header'])
				? '<th>' . $field['options']['data-header'] . '</th>'
				: '');
		}

		$thead .= '<th></th>';
		$thead .= '<th></th>';
		$thead .= '</tr>';

		$thead .= '</thead>';
		$table .= $thead;

		if ($data !== null) {

			// Debugger::dump($data);

			foreach($data as $i => $record) {
				$row = '<tr>';
				$cells = array('');
				// Debugger::dump('NEW ROW');
				// Debugger::dump($data);

				foreach($fields as $name => $field) {

					// Debugger::dump($field);


					$text = $this->_getText($field, $record);
					$hiddenValueField = $this->_generateHiddenValueField($field, $i, $record, $text);
					$hiddenValidationField = $this->_generateHiddenValidationField($field, $i);
					$span = $this->_generateSpanTag($field, $record);

					// NOTE: dont need _getText and _generateSpanTag.  Need to lose _generateSpanTag upon refactoring.
					if ($span) {
						$numCells = count($cells);
						$cells[$numCells - 1] = $span . $cells[$numCells - 1];
						$cells[] = '';
					}
					$cells[0] .= ($hiddenValidationField !== null ? $hiddenValidationField : '');
					$cells[0] .= $hiddenValueField;

				}

				array_pop($cells);

				foreach($cells as $cell) {
					$row .= '<td>' . $cell . '</td>';
				}

				$row .= $editCell;
				$row .= $deleteCell;
				$row .= '</tr>';
				$tbody .=  $row;

				$this->isPrimaryKeyFieldSet = false;
			}

			// Debugger::dump(htmlentities($row));


		}

		$tbody .= '</tbody>';
		$table .= $tbody;
		$table .= '</table>';

		return $table;
	}

}