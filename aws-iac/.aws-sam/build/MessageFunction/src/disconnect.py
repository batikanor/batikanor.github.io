import os
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    connection_id = event['requestContext']['connectionId']
    table.delete_item(
        Key={'player_id': connection_id}
    )
    return {
        'statusCode': 200,
        'body': 'Disconnected'
    }
