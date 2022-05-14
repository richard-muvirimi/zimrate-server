<?php

namespace App\Libraries;

use GraphQL\Error\Error;
use GraphQL\Error\InvariantViolation;
use GraphQL\Language\AST\Node;
use GraphQL\Language\AST\StringValueNode;
use GraphQL\Type\Definition\ScalarType;
use GraphQL\Utils\Utils;

/**
 * Cusom search type for graphql
 *
 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
 * @link    https://webonyx.github.io/graphql-php/type-definitions/scalars/
 * @version 1.0.0
 * ,@since   1.0.0
 *
 * phpcs:disable Squiz.Commenting.FunctionComment.ScalarTypeHintMissing
 */
class SearchType extends ScalarType{

	/**
	 * Serialize
	 *
	 * @param string $value Value.
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return string
	 *
     * phpcs:disable Squiz.Commenting.FunctionComment.ScalarTypeHintMissing
	 */
	public function serialize($value)
	{
		if (preg_match('/^[a-zA-Z0-9 ]+$/', $value) !== 1)
		{
			throw new InvariantViolation('Could not serialize following value as search parameter: ' . Utils::printSafe($value));
		}

		return $this->parseValue($value);
	}

	/**
	 * Parse Value
	 *
	 * @param string $value Value.
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return string
	 */
	public function parseValue($value)
	{
		if (preg_match('/^[a-zA-Z0-9 ]+$/', $value) !== 1)
		{
			throw new Error('Cannot represent following value as search parameter: ' . Utils::printSafeJson($value));
		}

		return $value;
	}

	/**
	 * Parce Literal
	 *
	 * @param Node       $valueNode Value Node.
	 * @param array|null $variables Variables.
	 *
	 * @author  Richard Muvirimi <rich4rdmuvirimi@gmail.com>
	 * @since   1.0.0
	 * @version 1.0.0
	 *
	 * @return string
	 */
	public function parseLiteral(Node $valueNode, ?array $variables = null):string
	{
		if (! $valueNode instanceof StringValueNode)
		{
			throw new Error('Query error: Can only parse strings got: ' . $valueNode->kind, [$valueNode]);
		}

		if (preg_match('/^[a-zA-Z0-9 ]+$/', $valueNode->value) !== 1)
		{
			throw new Error('Not a valid search string', [$valueNode]);
		}

		return $valueNode->value;
	}
}
