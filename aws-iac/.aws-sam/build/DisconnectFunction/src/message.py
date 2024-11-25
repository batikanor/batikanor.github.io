import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    connection_id = event['requestContext']['connectionId']
    body = json.loads(event['body'])
    action = body.get('action')

    if action == 'move':
        direction = body['direction']
        update_position(connection_id, direction)
    elif action == 'shoot':
        handle_shooting(connection_id)

    return {'statusCode': 200}

def update_position(player_id, direction):
    response = table.get_item(Key={'player_id': player_id})
    if 'Item' not in response:
        return

    player = response['Item']
    position = player['position']

    # Update position based on direction
    if direction == 'up':
        position['y'] -= 1
    elif direction == 'down':
        position['y'] += 1
    elif direction == 'left':
        position['x'] -= 1
    elif direction == 'right':
        position['x'] += 1

    table.update_item(
        Key={'player_id': player_id},
        UpdateExpression='SET position = :val',
        ExpressionAttributeValues={':val': position}
    )

def handle_shooting(player_id):
    # This function could add a "bullet" entry into DynamoDB or update another table
    print(f"Player {player_id} fired a bullet")
