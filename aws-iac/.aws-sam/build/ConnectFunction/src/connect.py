import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    connection_id = event['requestContext']['connectionId']
    player_id = connection_id  # Simplify by using connection ID as player ID
    position = {'x': 0, 'y': 0}  # Starting position

    # Add player to the DynamoDB table
    table.put_item(
        Item={
            'player_id': player_id,
            'nickname': 'Player_' + player_id[-4:],  # Generate a default nickname
            'position': position,
            'health': 1,
            'status': 'alive'
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps('Connected')
    }
